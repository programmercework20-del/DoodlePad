import { Message, Conversation, ConversationParticipant, Follower, User, Post } from "../../models/index.js";
import { getIO, getOnlineUsers } from "../../socket/socket.js";
import { createNotification } from "../../services/notification.service.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";
import sequelize from "../../config/db.js";
import { bucket } from "../../config/firebase.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import Block from "../../models/Block.js";

// 🔥 Doodle image rasterization
import { generateDoodleImage } from "../../utils/doodleRenderer.js"; 

// ✅ Universal UUID validator
const validateUUID = (uuid) => {
  if (!uuid || typeof uuid !== "string") return false;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\$/i;
  return re.test(uuid.trim());
};

// ✅ Clean UUID input (filters out "undefined", "null", empty strings, objects)
const cleanUuidInput = (rawVal) => {
  if (!rawVal) return null;
  if (typeof rawVal === "object" && rawVal.id) {
    return cleanUuidInput(rawVal.id);
  }
  const str = String(rawVal).trim();
  if (!str || str === "null" || str === "undefined" || str === "[object Object]") return null;
  return validateUUID(str) ? str : null;
};

// 🔥 HELPER 1: Clear Redis Conversation Cache (both v1 and v2 keys)
const clearConversationCache = async (senderId, receiverId) => {
  if (!redisClient?.isReady) return;
  try {
    const keys = [
      `conversations:${senderId}`,
      `conversations:${receiverId}`,
      `conversations:v2:${senderId}`,
      `conversations:v2:${receiverId}`
    ];
    await Promise.all(keys.map(k => redisClient.del(k)));
  } catch (e) {
    console.error("❌ Redis Cache clear error:", e.message);
  }
};

// 🔥 HELPER 2: Find existing 1-on-1 conversation between two users
const findSharedConversation = async (userA, userB, transaction = null) => {
  if (!validateUUID(userA) || !validateUUID(userB)) return null;

  const userAConvs = await ConversationParticipant.findAll({
    where: { userId: userA },
    attributes: ["conversationId"],
    transaction
  });

  const convIds = userAConvs.map((c) => c.conversationId);
  if (convIds.length === 0) return null;

  const match = await ConversationParticipant.findOne({
    where: {
      conversationId: { [Op.in]: convIds },
      userId: userB
    },
    transaction
  });

  if (!match) return null;
  return Conversation.findByPk(match.conversationId, { transaction });
};

// 🔥 HELPER 3: Smart Resolver for GET /messages/:id & POST /messages/seen/:id
const resolveConversationFromParam = async (rawParamId, currentUserId, transaction = null) => {
  const paramId = cleanUuidInput(rawParamId);
  if (!paramId) {
    return { isValidFormat: false, conversation: null, isParticipant: false, peerUserId: null };
  }

  // Case 1: Check if paramId is an actual Conversation ID
  const existingConv = await Conversation.findByPk(paramId, { transaction });
  if (existingConv) {
    let isParticipant = true;
    let peerUserId = null;

    if (currentUserId) {
      const participants = await ConversationParticipant.findAll({
        where: { conversationId: existingConv.id },
        transaction
      });
      isParticipant = participants.some(p => p.userId === currentUserId);
      const other = participants.find(p => p.userId !== currentUserId);
      peerUserId = other ? other.userId : null;
    }

    return {
      isValidFormat: true,
      conversation: existingConv,
      isParticipant,
      peerUserId
    };
  }

  // Case 2: paramId is NOT in Conversations -> FE passed a User UUID (e.g., 5a03977b-...)!
  if (currentUserId) {
    const sharedConv = await findSharedConversation(currentUserId, paramId, transaction);
    if (sharedConv) {
      return {
        isValidFormat: true,
        conversation: sharedConv,
        isParticipant: true,
        peerUserId: paramId
      };
    }

    // Check if paramId is a valid User in DB (brand new chat with 0 messages)
    const targetUser = await User.findByPk(paramId, { attributes: ["id"], transaction });
    if (targetUser) {
      return {
        isValidFormat: true,
        conversation: null,
        isParticipant: true,
        peerUserId: paramId
      };
    }
  }

  return { isValidFormat: true, conversation: null, isParticipant: false, peerUserId: null };
};

// 🔥 HELPER 4: Bulletproof Target Resolution for sendMessage & sendCardMessage
// 🔥 HELPER 4: Bulletproof Target Resolution for sendMessage & sendCardMessage
const resolveChatTargets = async ({ senderId, body = {}, params = {}, query = {}, cleanReplyToId, transaction = null }) => {
  let receiverId =
    cleanUuidInput(body.receiverId) ||
    cleanUuidInput(body.recipientId) ||
    cleanUuidInput(body.toUserId) ||
    cleanUuidInput(body.targetUserId) ||
    cleanUuidInput(body.peerId) ||
    cleanUuidInput(body.userId) ||
    cleanUuidInput(body.user) ||
    cleanUuidInput(params.receiverId) ||
    cleanUuidInput(query.receiverId) ||
    null;

  let conversationId =
    cleanUuidInput(body.conversationId) ||
    cleanUuidInput(body.chatId) ||
    cleanUuidInput(body.roomId) ||
    cleanUuidInput(params.conversationId) ||
    cleanUuidInput(query.conversationId) ||
    null;

  // 🛡️ Guard: If FE accidentally sent sender's own ID as receiverId, clear it out immediately
  if (receiverId && receiverId === senderId) {
    receiverId = null;
  }

  // Layer A: Fallback via replyToId
  if (cleanReplyToId && (!receiverId || !conversationId)) {
    const repliedMsg = await Message.findByPk(cleanReplyToId, { transaction });
    if (repliedMsg) {
      if (!conversationId) {
        conversationId = repliedMsg.conversationId;
      }
      if (!receiverId) {
        receiverId = repliedMsg.senderId === senderId ? repliedMsg.receiverId : repliedMsg.senderId;
      }
    }
  }

  // Layer B: Inspect conversationId if provided (Also auto-heals receiverId if it was cleared above)
  if (conversationId) {
    const convExists = await Conversation.findByPk(conversationId, { transaction });

    if (convExists) {
      // It is a real Conversation ID -> find the other participant if receiverId is missing/cleared
      if (!receiverId) {
        const otherParticipant = await ConversationParticipant.findOne({
          where: {
            conversationId,
            userId: { [Op.ne]: senderId }
          },
          transaction
        });

        if (otherParticipant) {
          receiverId = otherParticipant.userId;
        } else {
          const lastMsg = await Message.findOne({
            where: { conversationId },
            order: [["createdAt", "DESC"]],
            transaction
          });
          if (lastMsg) {
            receiverId = lastMsg.senderId === senderId ? lastMsg.receiverId : lastMsg.senderId;
          }
        }
      }
    } else {
      // 🚨 FE AUTO-HEAL: conversationId is NOT in conversations table!
      // Check if FE passed the receiver's User UUID inside conversationId!
      const userExists = await User.findByPk(conversationId, { attributes: ["id"], transaction });
      if (userExists && conversationId !== senderId) {
        if (!receiverId) {
          receiverId = conversationId;
        }
        const sharedConv = await findSharedConversation(senderId, receiverId, transaction);
        conversationId = sharedConv ? sharedConv.id : null;
      } else {
        conversationId = null;
      }
    }
  }

  // Layer C: If receiverId is actually a Conversation ID (swapped fields)
  if (receiverId) {
    const isActuallyUser = await User.findByPk(receiverId, { attributes: ["id"], transaction });
    if (!isActuallyUser) {
      const isActuallyConv = await Conversation.findByPk(receiverId, { transaction });
      if (isActuallyConv) {
        conversationId = isActuallyConv.id;
        const otherParticipant = await ConversationParticipant.findOne({
          where: {
            conversationId: isActuallyConv.id,
            userId: { [Op.ne]: senderId }
          },
          transaction
        });
        receiverId = otherParticipant ? otherParticipant.userId : null;
      }
    }
  }

  return {
    receiverId: validateUUID(receiverId) ? receiverId : null,
    conversationId: validateUUID(conversationId) ? conversationId : null
  };
};

// 🔥 HELPER 5: Reusable Sequelize Include for Populated Reply Object
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

// 🔥 HELPER 6: Gracefully sanitize deleted original messages
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

// 🔥 HELPER 7: Format message record consistently for API & Socket
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
    const { content, type = "text", postId, replyToId } = req.body;
    const cleanReplyToId = cleanUuidInput(replyToId || req.body?.replyTo?.id);

    console.log("📨 [sendMessage] Incoming body:", JSON.stringify(req.body));

    // 🔥 SMART TARGET RESOLUTION
    const { receiverId, conversationId } = await resolveChatTargets({
      senderId,
      body: req.body,
      params: req.params,
      query: req.query,
      cleanReplyToId,
      transaction
    });

    // 1. VALIDATION
    if (!receiverId) {
      await transaction.rollback();
      console.warn("⚠️ [sendMessage] Could not resolve receiverId from payload:", req.body);
      return res.status(400).json({
        success: false,
        message: "Valid receiverId is required"
      });
    }

    if ((req.body.replyToId || req.body?.replyTo?.id) && !cleanReplyToId) {
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

    if (conversationId) {
      conversation = await Conversation.findByPk(conversationId, { transaction });
    }

    if (!conversation) {
      conversation = await findSharedConversation(senderId, receiverId, transaction);
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
          conversationId: conversation.id
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
      postId: cleanUuidInput(postId),
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

    // 🚀 BACKGROUND TASKS
    const messageData = message.get({ plain: true });
    messageData.replyToId = cleanReplyToId;
    messageData.replyTo = populatedReplyTo;

    await clearConversationCache(senderId, receiverId);

    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const receiverSocketId = onlineUsers.get(receiverId);
      const senderSocketId = onlineUsers.get(senderId);

      // Make sure both sockets are joined to the real conversation.id room
      if (receiverSocketId) io.sockets.sockets.get(receiverSocketId)?.join(conversation.id);
      if (senderSocketId) io.sockets.sockets.get(senderSocketId)?.join(conversation.id);

      // 🔥 Chained Socket.IO emission: delivers to real conversation room, user_ room, AND peer userId room without duplicates!
      io.to(conversation.id)
        .to(`user_${receiverId}`)
        .to(receiverId)
        .to(senderId)
        .emit("receive_message", messageData);

      if (receiverSocketId) {
        await Message.update({ status: "delivered" }, { where: { id: message.id } }).catch(() => {});
        io.to(`user_${senderId}`).to(senderId).emit("message_status_update", {
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

    return res.json({ success: true, conversationId: conversation.id, message: messageData });

  } catch (err) {
    await transaction.rollback();
    console.error("🔥 SEND CRITICAL SYSTEM REJECTION:", err);
    return res.status(500).json({ success: false, message: "Send message failed", error: err.message });
  }
};


// ============================================================
// 🔥 SEND CARD MESSAGE (With Smart Fallback & Reply-to-Message)
// ============================================================
export const sendCardMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      cardType,
      caption,
      doodleData,
      audioTrimStart,
      audioDuration,
      replyToId
    } = req.body;

    const cleanReplyToId = cleanUuidInput(replyToId || req.body?.replyTo?.id);

    console.log("📨 [sendCardMessage] Incoming body:", JSON.stringify(req.body));

    // 🔥 SMART TARGET RESOLUTION
    let { receiverId, conversationId } = await resolveChatTargets({
      senderId,
      body: req.body,
      params: req.params,
      query: req.query,
      cleanReplyToId
    });

    if (!receiverId || !cardType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (receiverId or cardType)"
      });
    }

    if ((req.body.replyToId || req.body?.replyTo?.id) && !cleanReplyToId) {
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

    // Ensure conversation exists
    let conversation = conversationId ? await Conversation.findByPk(conversationId) : null;
    if (!conversation) {
      conversation = await findSharedConversation(senderId, receiverId);
    }
    if (!conversation) {
      const follow = await Follower.findOne({
        where: { followerId: receiverId, followingId: senderId, status: "accepted" }
      });
      conversation = await Conversation.create({ isRequest: !follow });
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: senderId },
        { conversationId: conversation.id, userId: receiverId }
      ]);
    }
    conversationId = conversation.id;

    // 🔥 VALIDATE & FETCH ORIGINAL REPLY MESSAGE (SECURITY GUARD)
    let populatedReplyTo = null;
    if (cleanReplyToId) {
      const originalMessage = await Message.findOne({
        where: {
          id: cleanReplyToId,
          conversationId
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

    await Conversation.update({
      lastMessage: `🖼️ Sent a ${cardType} card`,
      lastMessageAt: new Date()
    }, { where: { id: conversationId } });

    // 🚀 4. FIRE SOCKETS & NOTIFICATIONS
    const messageData = message.get({ plain: true });
    messageData.replyToId = cleanReplyToId;
    messageData.replyTo = populatedReplyTo;

    await clearConversationCache(senderId, receiverId);

    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const receiverSocketId = onlineUsers.get(receiverId);
      const senderSocketId = onlineUsers.get(senderId);

      if (receiverSocketId) io.sockets.sockets.get(receiverSocketId)?.join(conversationId);
      if (senderSocketId) io.sockets.sockets.get(senderSocketId)?.join(conversationId);

      io.to(conversationId)
        .to(`user_${receiverId}`)
        .to(receiverId)
        .to(senderId)
        .emit("receive_message", messageData);

      if (receiverSocketId) {
        await Message.update({ status: "delivered" }, { where: { id: message.id } }).catch(() => {});
        io.to(`user_${senderId}`).to(senderId).emit("message_status_update", {
          messageId: message.id,
          status: "delivered",
          conversationId
        });
      }
    } catch (socketErr) {
      console.error("⚠️ Card Socket delivery failed:", socketErr.message);
    }

    createNotification({
      senderId,
      receiverId,
      type: "MESSAGE",
      conversationId: conversationId,
      messageContent: caption || `Sent a ${cardType} card`,
      messageType: "card"
    }).catch(() => {});

    return res.status(201).json({ success: true, conversationId, message: messageData });

  } catch (error) {
    console.error("🔥 Send Card Message Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


// ============================================================
// MARK SEEN (Auto-heals if FE passes userId instead of conversationId)
// ============================================================
export const markSeen = async (req, res) => {
  try {
    const rawParamId = req.params.conversationId;
    const userId = req.user.id;

    const { isValidFormat, conversation, peerUserId } = await resolveConversationFromParam(rawParamId, userId);

    if (!isValidFormat) {
      return res.status(400).json({ success: false, message: "Invalid conversationId format" });
    }

    if (!conversation) {
      return res.json({ success: true, conversationId: null, receiverId: peerUserId });
    }

    const realConversationId = conversation.id;

    const [updatedCount] = await Message.update(
      { status: "seen" },
      {
        where: {
          conversationId: realConversationId,
          senderId: { [Op.ne]: userId },
          status: { [Op.ne]: "seen" }
        }
      }
    );

    if (updatedCount > 0) {
      await clearConversationCache(userId, peerUserId);
    }

    try {
      const io = getIO();
      if (io) {
        io.to(realConversationId)
          .to(rawParamId)
          .emit("messages_seen", { conversationId: realConversationId, userId });
      }
    } catch (socketErr) {
      console.error("⚠️ Socket emit failed in markSeen:", socketErr.message);
    }

    return res.json({ success: true, conversationId: realConversationId, receiverId: peerUserId });

  } catch (err) {
    console.error("🔥 SEEN ERROR:", err);
    return res.status(500).json({ success: false, message: "Seen failed", error: err.message });
  }
};


// ============================================================
// GET MESSAGES (Auto-heals if FE passes userId + Populates replyTo)
// ============================================================
export const getMessages = async (req, res) => {
  try {
    const rawParamId = req.params.conversationId;
    const userId = req.user?.id;

    const { isValidFormat, conversation, isParticipant, peerUserId } = await resolveConversationFromParam(rawParamId, userId);

    if (!isValidFormat) {
      return res.status(400).json({ success: false, message: "Invalid conversationId format" });
    }

    if (!conversation) {
      return res.json({
        success: true,
        conversationId: null,
        receiverId: peerUserId,
        count: 0,
        messages: []
      });
    }

    if (userId && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this conversation"
      });
    }

    const realConversationId = conversation.id;

    // Auto-join user's active socket to the real conversation room
    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const sockId = userId ? onlineUsers.get(userId) : null;
      if (sockId) {
        io.sockets.sockets.get(sockId)?.join(realConversationId);
      }
    } catch (_) {}

    const messages = await Message.findAll({
      where: { conversationId: realConversationId },
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
        getReplyIncludeConfig()
      ]
    });

    const formattedMessages = messages.map(formatMessagePayload);

    return res.json({
      success: true,
      conversationId: realConversationId,
      receiverId: peerUserId,
      count: formattedMessages.length,
      messages: formattedMessages
    });

  } catch (error) {
    console.error("🔥 GET MESSAGES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch messages", error: error.message });
  }
};


// ============================================================
// EDIT MESSAGE
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
      getIO()
        .to(message.conversationId)
        .to(`user_${message.receiverId}`)
        .to(message.receiverId)
        .emit("message_updated", updatedPayload);
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
      getIO()
        .to(message.conversationId)
        .to(`user_${message.receiverId}`)
        .to(message.receiverId)
        .emit("message_deleted", messageId);
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