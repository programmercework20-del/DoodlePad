import { Message, Conversation, ConversationParticipant, Follower, User, Post } from "../../models/index.js";
import { getIO, getOnlineUsers } from "../../socket/socket.js";
import { createNotification } from "../../services/notification.service.js";
import { Op, Sequelize } from "sequelize"; // ✅ Sequelize import add kiya for Op.in
import redisClient from "../../config/redis.js"; 
import sequelize from "../../config/db.js"; // DB Instance
import { validate as isUUID } from "uuid";
import { bucket } from "../../config/firebase.js"; 

// ============================================================
// HELPERS
// ============================================================
const validateUUID = (uuid) => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid);
};

// ============================================================
// SEND MESSAGE (With Transaction & GCS Storage)
// ============================================================
export const sendMessage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const senderId = req.user.id;
    const receiverId = req.body.receiverId;
    let { content, type = "text", postId } = req.body; 

    // 1. VALIDATION
    if (!receiverId || !isUUID(receiverId)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ success: false, message: "Valid receiverId is required" });
    }

    if (!content && !req.file && type !== "shared_post") {
      if (transaction) await transaction.rollback();
      return res.status(400).json({ success: false, message: "Message content or file is required" });
    }

    let mediaUrl = null;
    let finalType = type;

    // 2. GCS FILE UPLOAD
    if (req.file) {
      const fileName = `chat_media/chat_${Date.now()}_${req.file.originalname}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      
      mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      const mime = req.file.mimetype;
      if (mime.startsWith("image")) finalType = "image";
      else if (mime.startsWith("audio")) finalType = "audio";
      else if (mime.startsWith("video")) finalType = "video";
      
      content = null; 
    }

    // 3. FIND OR CREATE CONVERSATION
    let conversation = null;
    const senderConvs = await ConversationParticipant.findAll({
      where: { userId: senderId },
      attributes: ["conversationId"],
      transaction
    });

    const convIds = senderConvs.map(c => c.conversationId);
    if (convIds.length > 0) {
      const match = await ConversationParticipant.findOne({
        // ✅ Fixed: Sequelize.Op ko Op se replace kiya (kyunki upar import hai)
        where: { conversationId: { [Op.in]: convIds }, userId: receiverId },
        transaction
      });
      if (match) {
        conversation = await Conversation.findByPk(match.conversationId, { transaction });
      }
    }

    if (!conversation) {
      const follow = await Follower.findOne({
        where: { followerId: receiverId, followingId: senderId, status: "accepted" },
        transaction
      });
      const isRequest = !follow;

      conversation = await Conversation.create({ isRequest }, { transaction });
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: senderId },
        { conversationId: conversation.id, userId: receiverId }
      ], { transaction });
    }

    // 4. CREATE MESSAGE
    const message = await Message.create({
      conversationId: conversation.id,  
      senderId,
      receiverId,
      content: finalType === "shared_post" ? "Shared a post" : content,
      mediaUrl,
      type: finalType,
      postId: postId || null, 
      status: "sent"
    }, { transaction });

    // 5. UPDATE CONVERSATION PREVIEW
    const lastMsgPreview = finalType === "shared_post" ? "🔗 Post" : (content || (finalType === "image" ? "📸 Image" : finalType === "audio" ? "🎤 Audio" : "🎬 Video"));
    
    await conversation.update({ 
      lastMessage: lastMsgPreview, 
      lastMessageAt: new Date() 
    }, { transaction });

    await transaction.commit();

    // 6. SOCKET & CACHE
    const io = getIO();
    const onlineUsers = getOnlineUsers();
    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", message);
      message.update({ status: "delivered" }).catch(e => console.error("Delivered update failed", e));
    }

    if (redisClient?.isReady) {
      await Promise.all([
        redisClient.del(`conversations:${senderId}`),
        redisClient.del(`conversations:${receiverId}`)
      ]);
    }

    createNotification({ senderId, receiverId, type: "MESSAGE" }).catch(e => console.error(e));

    return res.json({ success: true, message });

  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("🔥 SEND ERROR:", err);
    return res.status(500).json({ success: false, message: "Send message failed" });
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
      return res.status(400).json({
        success: false,
        message: "Invalid conversationId format"
      });
    }

    await Message.update(
      { status: "seen" },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          status: { [Op.ne]: "seen" }
        }
      }
    );

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
// GET MESSAGES
// ============================================================
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!validateUUID(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversationId format"
      });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Post,
          as: "post", 
          attributes: ["id", "mediaUrls", "caption"],
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

    return res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    console.error("🔥 GET MESSAGES ERROR:", error); 
    return res.status(500).json({ success: false, message: "Failed to fetch messages", error: error.message });
  }
};

// ============================================================
// OTHER ACTIONS
// ============================================================
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const message = await Message.findByPk(messageId);
    if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await message.update({ content });
    getIO().to(message.conversationId).emit("message_updated", message);
    res.json({ success: true, message });
  } catch (err) { res.status(500).json({ message: "Edit failed" });
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByPk(messageId);
    if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await message.destroy();
    getIO().to(message.conversationId).emit("message_deleted", message);
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};  
}