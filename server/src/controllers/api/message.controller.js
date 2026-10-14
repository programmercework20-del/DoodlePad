import { Message, Conversation, ConversationParticipant, Follower, User, Post } from "../../models/index.js";
import { getIO, getOnlineUsers } from "../../socket/socket.js";
import { createNotification } from "../../services/notification.service.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";
import sequelize from "../../config/db.js";
import { validate as isUUID } from "uuid";
import { bucket } from "../../config/firebase.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import Block from "../../models/Block.js";

// 🔥 NAYA IMPORT: Doodle image rasterization
import { generateDoodleImage } from "../../utils/doodleRenderer.js"; 

const validateUUID = (uuid) => {
  if (!uuid || typeof uuid !== "string") return false;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\$/i;
  return re.test(uuid.trim());
};

// 🔥 HELPER 1: Normalize replyToId from JSON or multipart/form-data
const normalizeReplyToId = (rawReplyToId) => {
  if (!rawReplyToId) return null;
  const str = String(rawReplyToId).trim();
  if (!str || str === "null" || str === "undefined") return null;
  return str;
};

// 🔥 HELPER 2: Reusable Sequelize Include for Populated Reply Object
const getReplyIncludeConfig = () => ({
  model: Message,
  as: "replyTo",
  attributes: [
    "id",
    "conversationId",
    "senderId",
    "receiverId",
    "content",
    "mediaUrl",
    "thumbnail",
    "duration",
    "type",
    "postId",
    "cardSlides",
    "status",
    "createdAt"
  ],
  required: false,
  include: [
    {
      model: User,
      as: "sender",
      attributes: ["id", "username", "name", "profilePhoto"],
      required: false
    },
    {
      model: Post,
      as: "post",
      attributes: ["id", "mediaUrls", "caption", "thumbnail", "type"],
      required: false,
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto"],
          required: false
        }
      ]
    }
  ]
});

// 🔥 HELPER 3: Gracefully sanitize deleted original messages
const sanitizeReplyObject = (replyMsg) => {
  if (!replyMsg) return null;
  const plain = typeof replyMsg.get === "function" ? replyMsg.get({ plain: true }) : { ...replyMsg };

  if (plain.status === "deleted") {
    return {
      id: plain.id,
      conversationId: plain.conversationId,
      senderId: plain.senderId,
      receiverId: plain.receiverId,
      sender: plain.sender || null,
      type: plain.type,
      content: "This message was deleted",
      mediaUrl: null,
      thumbnail: null,
      duration: null,
      postId: null,
      post: null,
      cardSlides: null,
      status: "deleted",
      isDeleted: true,
      createdAt: plain.createdAt
    };
  }

  return plain;
};

// 🔥 HELPER 4: Format message record consistently for API & Socket
const formatMessagePayload = (msgInstanceOrPlain) => {
  const plain = typeof msgInstanceOrPlain.get === "function"
    ? msgInstanceOrPlain.get({ plain: true })
    : { ...msgInstanceOrPlain };

  plain.replyToId = plain.replyToId || null;
  plain.replyTo = plain.replyTo ? sanitizeReplyObject(plain.replyTo) : null;
  return plain;
};


// ============================================================
// SEND MESSAGE (Text, Image, Video, Audio, Doodle, Shared Post)
// ============================================================
export const sendMessage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const senderId = req.user.id;
    const { receiverId, content, type = "text", postId, conversationId, replyToId } = req.body;
    const cleanReplyToId = normalizeReplyToId(replyToId);

    // 1. VALIDATION
    if (!receiverId || !validateUUID(receiverId)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Valid receiverId is required" });
    }

    if (cleanReplyToId && !validateUUID(cleanReplyToId)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid replyToId format" });
    }

    if (!content && !req.file && type !== "shared_post") {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Message content or file is required" });
    }

    // 🔥 1.5 BLOCK STATUS CHECK (SECURITY GUARD)
    const blockCheck = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId }
        ]
      },
      transaction
    });

    if (blockCheck) {
      await transaction.rollback();
      return res.status(403).json({ 
        success: false, 
        message: "Message cannot be sent due to block status." 
      });
    }

    let mediaUrl = null;
    let thumbnail = null;
    let finalType = type;
    let duration = null;

    // 2. FILE UPLOAD & MEDIA LOGIC
    if (req.file) {
      const fileName = `chat_media/chat_${Date.now()}_${req.file.originalname}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      const mime = req.file.mimetype;
      
      if (mime.startsWith("image")) {
        finalType = "image";
      } 
      else if (mime.startsWith("audio")) {
        finalType = "audio";
        try {
          const tempAudioPath = path.join(os.tmpdir(), `chat_a_${Date.now()}.mp3`);
          fs.writeFileSync(tempAudioPath, req.file.buffer);

          duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
              if (err) {
                reject(err);
              } else {
                const exactDuration = metadata.format.duration;
                resolve(exactDuration ? Math.round(exactDuration) : null);
              }
            });
          });

          if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        } catch (e) {
          console.error("⚠️ Audio duration calculation failed:", e);
        }
      } 
      else if (mime.startsWith("video")) {
        finalType = "video";
        try {
          const tempVideoPath = path.join(os.tmpdir(), `chat_v_${Date.now()}.mp4`);
          const tempThumbPath = path.join(os.tmpdir(), `chat_t_${Date.now()}.jpg`);
          fs.writeFileSync(tempVideoPath, req.file.buffer);

          await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
              .inputOptions('-threads 2')
              .screenshots({
                count: 1,
                timemarks: ['00:00:01'],
                filename: path.basename(tempThumbPath),
                folder: os.tmpdir(),
                size: '320x?'
              })
              .on('end', resolve)
              .on('error', reject);
          });

          const thumbFileName = `chat_thumbnails/t_${Date.now()}.jpg`;
          const thumbBlob = bucket.file(thumbFileName);
          await thumbBlob.save(fs.readFileSync(tempThumbPath), {
            metadata: { contentType: 'image/jpeg' }
          });
          thumbnail = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;

          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
          if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
        } catch (e) {
          console.error("⚠️ Chat video thumbnail generation failed:", e);
        }
      }
    }

    // 3. FIND OR CREATE CONVERSATION
    let conversation = null;

    if (conversationId && validateUUID(conversationId)) {
      conversation = await Conversation.findByPk(conversationId, { transaction });
    }

    if (!conversation) {
      const senderConvs = await ConversationParticipant.findAll({
        where: { userId: senderId },
        attributes: ["conversationId"],
        transaction
      });

      const convIds = senderConvs.map(c => c.conversationId);

      if (convIds.length > 0) {
        const match = await ConversationParticipant.findOne({
          where: { conversationId: { [Op.in]: convIds }, userId: receiverId },
          transaction
        });
        if (match) {
          conversation = await Conversation.findByPk(match.conversationId, { transaction });
        }
      }
    }

    if (!conversation) {
      const follow = await Follower.findOne({
        where: { followerId: receiverId, followingId: senderId, status: "accepted" },
        transaction
      });

      conversation = await Conversation.create({ isRequest: !follow }, { transaction });
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: senderId },
        { conversationId: conversation.id, userId: receiverId }
      ], { transaction });
    }

    // 🔥 3.5 VALIDATE & FETCH ORIGINAL REPLY MESSAGE (SECURITY GUARD)
    let populatedReplyTo = null;
    if (cleanReplyToId) {
      const originalMessage = await Message.findOne({
        where: {
          id: cleanReplyToId,
          conversationId: conversation.id // Ensures reply belongs to the SAME conversation
        },
        include: getReplyIncludeConfig().include,
        transaction
      });

      if (!originalMessage) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Referenced reply message not found in this conversation"
        });
      }

      populatedReplyTo = sanitizeReplyObject(originalMessage);
    }

    // 4. CREATE MESSAGE
    const message = await Message.create({
      conversationId: conversation.id,
      senderId,
      receiverId,
      content: finalType === "shared_post" ? "Shared a post" : (content || ""),
      mediaUrl,
      thumbnail,
      duration,
      type: finalType,
      postId: postId || null,
      replyToId: cleanReplyToId,
      status: "sent"
    }, { transaction });

    // 5. UPDATE CONVERSATION PREVIEW
    const lastMsgPreview = finalType === "shared_post"
      ? "🔗 Post"
      : (content || (finalType === "image" ? "📸 Image" : finalType === "audio" ? "🎤 Audio" : finalType === "doodle" ? "🎨 Doodle" : "🎬 Video"));

    await conversation.update({
      lastMessage: lastMsgPreview,
      lastMessageAt: new Date()
    }, { transaction });

    await transaction.commit();

    // 🚀 BACKGROUND TASKS (Safe and non-blocking execution)
    const messageData = message.get({ plain: true });
    messageData.replyToId = cleanReplyToId;
    messageData.replyTo = populatedReplyTo;

    if (redisClient?.isReady) {
      Promise.all([
        redisClient.del(`conversations:${senderId}`),
        redisClient.del(`conversations:${receiverId}`)
      ]).catch(e => console.error("❌ Redis Cache clear error:", e));
    }

    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const receiverSocketId = onlineUsers.get(receiverId);

      // Room distribution (Active users inside room)
      io.to(conversation.id).emit("receive_message", messageData);

      // Direct channel (Active users outside current room layout)
      io.to(`user_${receiverId}`).emit("receive_message", messageData);

      if (receiverSocketId) {
        await Message.update({ status: "delivered" }, { where: { id: message.id } }).catch(() => {});
        io.to(`user_${senderId}`).emit("message_status_update", {
          messageId: message.id,
          status: "delivered",
          conversationId: conversation.id
        });
      }
    } catch (socketErr) {
      console.error("⚠️ Socket delivery module failure context:", socketErr.message);
    }

    createNotification({
      senderId,
      receiverId,
      type: "MESSAGE",
      conversationId: conversation.id,
      messageContent: finalType === "shared_post" ? "Shared a post" : (content || ""),
      messageType: finalType
    }).catch(() => {});

    return res.json({ success: true, message: messageData });

  } catch (err) {
    await transaction.rollback();
    console.error("🔥 SEND CRITICAL SYSTEM REJECTION:", err);
    return res.status(500).json({ success: false, message: "Send message failed", error: err.message });
  }
};


// ============================================================
// 🔥 SEND CARD MESSAGE (With Reply-to-Message Support)
// ============================================================
export const sendCardMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      receiverId,
      conversationId,
      cardType,
      caption,
      doodleData,
      audioTrimStart,
      audioDuration,
      replyToId
    } = req.body;

    const cleanReplyToId = normalizeReplyToId(replyToId);

    if (!receiverId || !conversationId || !cardType) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!validateUUID(receiverId) || !validateUUID(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid receiverId or conversationId format" });
    }

    if (cleanReplyToId && !validateUUID(cleanReplyToId)) {
      return res.status(400).json({ success: false, message: "Invalid replyToId format" });
    }

    // 🛡️ SECURITY GUARD: Check block status
    const blockCheck = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId }
        ]
      }
    });

    if (blockCheck) {
      return res.status(403).json({ success: false, message: "Message cannot be sent due to block status." });
    }

    // 🔥 VALIDATE & FETCH ORIGINAL REPLY MESSAGE (SECURITY GUARD)
    let populatedReplyTo = null;
    if (cleanReplyToId) {
      const originalMessage = await Message.findOne({
        where: {
          id: cleanReplyToId,
          conversationId // Ensures reply belongs to the SAME conversation
        },
        include: getReplyIncludeConfig().include
      });

      if (!originalMessage) {
        return res.status(400).json({
          success: false,
          message: "Referenced reply message not found in this conversation"
        });
      }

      populatedReplyTo = sanitizeReplyObject(originalMessage);
    }

    let mainMediaUrl = null;
    let finalAudioUrl = null;
    let finalAudioDuration = 0;

    // 🖼️ 1. HANDLE MAIN MEDIA (IMAGE / DOODLE)
    if (cardType === "image" && req.files?.image) {
      const imageFile = req.files.image[0];
      const fileName = `message_images/card_${senderId}_${Date.now()}.jpg`;
      const blob = bucket.file(fileName);
      await blob.save(imageFile.buffer, { metadata: { contentType: imageFile.mimetype } });
      mainMediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } 
    else if (cardType === "doodle" && doodleData) {
      const parsedDoodlePaths = typeof doodleData === "string" ? JSON.parse(doodleData) : doodleData;
      if (Array.isArray(parsedDoodlePaths) && parsedDoodlePaths.length > 0) {
        const imageBuffer = await generateDoodleImage(parsedDoodlePaths); 
        if (imageBuffer) {
          const fileName = `message_doodles/card_${senderId}_${Date.now()}.webp`;
          const blob = bucket.file(fileName);
          await blob.save(imageBuffer, { metadata: { contentType: 'image/webp' } });
          mainMediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        }
      }
    }

    // 🎵 2. HANDLE CAPTION AUDIO (TRIM & UPLOAD)
    if (req.files && req.files.audio && req.files.audio.length > 0) {
      const audioFile = req.files.audio[0];
      const tempAudioPath = path.join(os.tmpdir(), `temp_card_a_${Date.now()}.mp4`);
      const processedAudioPath = path.join(os.tmpdir(), `proc_card_a_${Date.now()}.mp4`);
      let uploadBuffer = audioFile.buffer;

      let trimStart = audioTrimStart ? parseFloat(audioTrimStart) : 0;
      let trimDuration = audioDuration ? parseFloat(audioDuration) : null;

      try {
        fs.writeFileSync(tempAudioPath, audioFile.buffer);

        await new Promise((resolve, reject) => {
          let ffCommand = ffmpeg(tempAudioPath);
          if (trimStart > 0) ffCommand = ffCommand.setStartTime(trimStart);
          if (trimDuration > 0) ffCommand = ffCommand.setDuration(trimDuration);

          ffCommand.outputOptions(['-c', 'copy', '-movflags', '+faststart'])
            .save(processedAudioPath)
            .on('end', resolve)
            .on('error', reject);
        });

        uploadBuffer = fs.readFileSync(processedAudioPath);
        
        finalAudioDuration = await new Promise((resolve) => {
          ffmpeg.ffprobe(processedAudioPath, (err, metadata) => {
            if (err) resolve(0);
            else resolve(metadata.format.duration ? Math.round(metadata.format.duration) : 0);
          });
        });

      } catch (e) {
        console.error("⚠️ Backend Card Audio Trim Error:", e.message);
        finalAudioDuration = await new Promise((resolve) => {
           ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
              if (err) resolve(0);
              else resolve(metadata.format.duration ? Math.round(metadata.format.duration) : 0);
           });
        });
      } finally {
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
      }

      const fileName = `message_audios/card_${senderId}_${Date.now()}_audio.mp4`;
      const blob = bucket.file(fileName);
      await blob.save(uploadBuffer, { metadata: { contentType: audioFile.mimetype } });
      finalAudioUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    // 🛠️ 3. BUILD JSONB PAYLOAD & SAVE MESSAGE
    const cardPayload = [{
      type: cardType,
      mediaUrl: mainMediaUrl,
      caption: caption || "",
      audioUrl: finalAudioUrl,
      audioDuration: finalAudioDuration
    }];

    const message = await Message.create({
      conversationId,
      senderId,
      receiverId,
      type: "card",
      cardSlides: cardPayload,
      replyToId: cleanReplyToId,
      status: "sent"
    });

    // Update conversation preview snippet for chat list
    await Conversation.update({
      lastMessage: `🖼️ Sent a ${cardType} card`,
      lastMessageAt: new Date()
    }, { where: { id: conversationId } });

    // 🚀 4. FIRE SOCKETS & NOTIFICATIONS
    const messageData = message.get({ plain: true });
    messageData.replyToId = cleanReplyToId;
    messageData.replyTo = populatedReplyTo;

    if (redisClient?.isReady) {
      Promise.all([
        redisClient.del(`conversations:${senderId}`),
        redisClient.del(`conversations:${receiverId}`)
      ]).catch(e => console.error("❌ Redis Cache clear error:", e));
    }

    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const receiverSocketId = onlineUsers.get(receiverId);

      // Emit to rooms
      io.to(conversationId).emit("receive_message", messageData);
      io.to(`user_${receiverId}`).emit("receive_message", messageData);

      // Delivered status fallback
      if (receiverSocketId) {
        await Message.update({ status: "delivered" }, { where: { id: message.id } }).catch(() => {});
        io.to(`user_${senderId}`).emit("message_status_update", {
          messageId: message.id,
          status: "delivered",
          conversationId
        });
      }
    } catch (socketErr) {
      console.error("⚠️ Card Socket delivery failed:", socketErr.message);
    }

    // Push notification trigger
    createNotification({
      senderId,
      receiverId,
      type: "MESSAGE",
      conversationId: conversationId,
      messageContent: caption || `Sent a ${cardType} card`,
      messageType: "card"
    }).catch(() => {});

    return res.status(201).json({ success: true, message: messageData });

  } catch (error) {
    console.error("🔥 Send Card Message Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


// ============================================================
// MARK SEEN
// ============================================================
export const markSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!validateUUID(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId format" });
    }

    // 1. Update messages status in DB
    const [updatedCount] = await Message.update(
      { status: "seen" },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          status: { [Op.ne]: "seen" }
        }
      }
    );

    // 🚀 2. Clear Redis Cache for real-time count sync on list page
    if (updatedCount > 0 && redisClient?.isReady) {
      await redisClient.del(`conversations:${userId}`);
    }

    // 3. Socket broadcast for real-time blue ticks
    try {
      const io = getIO();
      if (io) {
        io.to(conversationId).emit("messages_seen", { conversationId, userId });
      }
    } catch (socketErr) {
      console.error("⚠️ Socket emit failed in markSeen:", socketErr.message);
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("🔥 SEEN ERROR:", err);
    return res.status(500).json({ success: false, message: "Seen failed", error: err.message });
  }
};


// ============================================================
// GET MESSAGES (With Post Thumbnail & Reply-To Inclusion)
// ============================================================
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;

    if (!validateUUID(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId format" });
    }

    // 🛡️ SECURITY GUARD: Verify user is a participant in this conversation
    if (userId) {
      const isParticipant = await ConversationParticipant.findOne({
        where: { conversationId, userId }
      });

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this conversation"
        });
      }
    }

    const messages = await Message.findAll({
      where: { conversationId },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Post,
          as: "post",
          attributes: ["id", "mediaUrls", "caption", "thumbnail", "type"], 
          required: false,
          include: [
            {
              model: User,
              as: "author",
              attributes: ["id", "username", "profilePhoto"],
              required: false
            }
          ]
        },
        // 🔥 PHASE 3: Populate original message in replyTo
        getReplyIncludeConfig()
      ]
    });

    const formattedMessages = messages.map(formatMessagePayload);

    return res.json({
      success: true,
      count: formattedMessages.length,
      messages: formattedMessages
    });

  } catch (error) {
    console.error("🔥 GET MESSAGES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch messages", error: error.message });
  }
};


// ============================================================
// EDIT MESSAGE (Preserves replyTo in Response & Socket)
// ============================================================
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const message = await Message.findByPk(messageId, {
      include: [getReplyIncludeConfig()]
    });

    if (!message || message.senderId !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await message.update({ content });
    const updatedPayload = formatMessagePayload(message);

    try {
      getIO().to(message.conversationId).emit("message_updated", updatedPayload);
    } catch (e) {
      console.error("Socket emit failed:", e.message);
    }

    res.json({ success: true, message: updatedPayload });
  } catch (err) {
    res.status(500).json({ message: "Edit failed" });
  }
};


// ============================================================
// DELETE MESSAGE
// ============================================================
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByPk(messageId);

    if (!message || message.senderId !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await message.update({ status: "deleted" });

    try {
      getIO().to(message.conversationId).emit("message_deleted", messageId);
    } catch (e) {
      console.error("Socket emit failed:", e.message);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};


// ============================================================
// ACCEPT REQUEST
// ============================================================
export const acceptRequest = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    await conversation.update({ isRequest: false });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};


// ============================================================
// REJECT REQUEST
// ============================================================
export const rejectRequest = async (req, res) => {
  try {
    await Conversation.destroy({ where: { id: req.params.conversationId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};