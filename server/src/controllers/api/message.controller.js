import { Message, Conversation, ConversationParticipant, Follower, User } from "../../models/index.js";
import { getIO, getOnlineUsers } from "../../socket/socket.js";
import { createNotification } from "../../services/notification.service.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js"; // Standardized redis import
import sequelize from "../../config/db.js";
import { validate as isUUID } from "uuid";
import { bucket } from "../../config/firebase.js"; // 🔥 GCS Bucket Integration

// ============================================================
// SEND MESSAGE (With Transaction & GCS Storage)
// ============================================================
export const sendMessage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const senderId = req.user.id;
    const receiverId = req.body.receiverId;
    let { content, type = "text" } = req.body;

    // ✅ VALIDATION
    if (!receiverId || !isUUID(receiverId)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Valid receiverId is required" });
    }

    if (!content && !req.file) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Message content or file is required" });
    }

    let mediaUrl = null;
    let finalType = type;

    // 🔥 GCS FILE UPLOAD (Localhost 5000 fix)
    if (req.file) {
      const fileName = `chat_media/chat_${Date.now()}_${req.file.originalname}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      
      mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      const mime = req.file.mimetype;
      if (mime.startsWith("image")) finalType = "image";
      else if (mime.startsWith("audio")) finalType = "audio";
      else if (mime.startsWith("video")) finalType = "video";
      
      content = null; // file present → ignore text content
    }

    // 🔒 FOLLOW CHECK (For Message Request logic)
    const follow = await Follower.findOne({
      where: { followerId: receiverId, followingId: senderId, status: "accepted" },
      transaction
    });
    const isRequest = !follow;

    // ✅ FIND OR CREATE CONVERSATION
    let conversation = null;
    const senderConvs = await ConversationParticipant.findAll({
      where: { userId: senderId },
      attributes: ["conversationId"],
      transaction
    });

    const convIds = senderConvs.map(c => c.conversationId);
    if (convIds.length > 0) {
      const match = await ConversationParticipant.findOne({
        where: { conversationId: convIds, userId: receiverId },
        transaction
      });
      if (match) {
        conversation = await Conversation.findByPk(match.conversationId, { transaction });
      }
    }

    if (!conversation) {
      conversation = await Conversation.create({ isRequest }, { transaction });
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: senderId },
        { conversationId: conversation.id, userId: receiverId }
      ], { transaction });
    }

    // 💬 CREATE MESSAGE
    const message = await Message.create({
      conversationId: conversation.id,
      senderId,
      receiverId,
      content,
      mediaUrl,
      type: finalType,
      status: "sent"
    }, { transaction });

    // ✅ UPDATE CONVERSATION PREVIEW
    const lastMsgPreview = content || (finalType === "image" ? "📸 Image" : finalType === "audio" ? "🎤 Audio" : finalType === "video" ? "🎬 Video" : "Media");
    await conversation.update({ lastMessage: lastMsgPreview, lastMessageAt: new Date() }, { transaction });

    await transaction.commit();

    // 📡 SOCKET EMIT
    const io = getIO();
    const onlineUsers = getOnlineUsers();
    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", message);
      await message.update({ status: "delivered" });
    }

    // 🔥 CLEAR REDIS CACHE for Conversation List
    if (redisClient?.isReady) {
      await redisClient.del(`conversations:${senderId}`);
      await redisClient.del(`conversations:${receiverId}`);
    }

    // 🔔 NOTIFICATION (Send silently)
    createNotification({ senderId, receiverId, type: "MESSAGE" }).catch(e => console.error(e));

    return res.json({ success: true, message });

  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("🔥 SEND ERROR:", err);
    return res.status(500).json({ success: false, message: "Send message failed" });
  }
};

// ============================================================
// MARK SEEN (With Socket & Cache Update)
// ============================================================
export const markSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!isUUID(conversationId)) return res.status(400).json({ message: "Invalid ID" });

    await Message.update(
      { status: "seen" },
      { where: { conversationId, receiverId: userId, status: { [Op.ne]: "seen" } } }
    );

    const io = getIO();
    io.to(conversationId).emit("messages_seen", { conversationId, userId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Seen failed" });
  }
};

// ============================================================
// GET MESSAGES (No Caching for Real-time consistency)
// ============================================================
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!isUUID(conversationId)) return res.status(400).json({ message: "Invalid ID" });

    const messages = await Message.findAll({
      where: { conversationId },
      order: [["createdAt", "ASC"]],
      limit: 100 // Load last 100
    });

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// ... Edit, Delete, Accept/Reject Request remains same but with consistent success:true wrap
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const message = await Message.findByPk(messageId);
    if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await message.update({ content });
    getIO().to(message.conversationId).emit("message_updated", message);
    res.json({ success: true, message });
  } catch (err) { res.status(500).json({ message: "Edit failed" }); }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByPk(messageId);
    if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await message.update({ status: "deleted" });
    getIO().to(message.conversationId).emit("message_deleted", messageId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: "Delete failed" }); }
};

export const acceptRequest = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: "Not found" });
    await conversation.update({ isRequest: false });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
};

export const rejectRequest = async (req, res) => {
  try {
    await Conversation.destroy({ where: { id: req.params.conversationId } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
};