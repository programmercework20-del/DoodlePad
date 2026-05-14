// import { Message, Conversation, ConversationParticipant, Follower, User } from "../../models/index.js";
// import { getIO, getOnlineUsers } from "../../socket/socket.js";
// import { createNotification } from "../../services/notification.service.js";
// import { Op } from "sequelize";
// import redisClient from "../../config/redis.js"; // Standardized redis import
// import sequelize from "../../config/db.js";
// import { validate as isUUID } from "uuid";
// import { bucket } from "../../config/firebase.js"; // 🔥 GCS Bucket Integration

// // ============================================================
// // SEND MESSAGE (With Transaction & GCS Storage)
// // ============================================================



// export const sendMessage = async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const senderId = req.user.id;
//     const receiverId = req.body.receiverId;
//     let { content, type = "text", postId } = req.body; // 👈 postId extract karein

//     // 1. VALIDATION
//     if (!receiverId || !isUUID(receiverId)) {
//       if (transaction) await transaction.rollback();
//       return res.status(400).json({ success: false, message: "Valid receiverId is required" });
//     }

//     // 🔥 FIX: shared_post ke liye content optional hai
//     if (!content && !req.file && type !== "shared_post") {
//       if (transaction) await transaction.rollback();
//       return res.status(400).json({ success: false, message: "Message content or file is required" });
//     }

//     let mediaUrl = null;
//     let finalType = type;

//     // 2. GCS FILE UPLOAD
//     if (req.file) {
//       const fileName = `chat_media/chat_${Date.now()}_${req.file.originalname}`;
//       const blob = bucket.file(fileName);
//       await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      
//       mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

//       const mime = req.file.mimetype;
//       if (mime.startsWith("image")) finalType = "image";
//       else if (mime.startsWith("audio")) finalType = "audio";
//       else if (mime.startsWith("video")) finalType = "video";
      
//       content = null; 
//     }

//     // 3. FIND OR CREATE CONVERSATION (Optimized)
//     let conversation = null;
//     const senderConvs = await ConversationParticipant.findAll({
//       where: { userId: senderId },
//       attributes: ["conversationId"],
//       transaction
//     });

//     const convIds = senderConvs.map(c => c.conversationId);
//     if (convIds.length > 0) {
//       const match = await ConversationParticipant.findOne({
//         // Sequelize Op.in use karna safe rehta hai
//         where: { conversationId: { [Sequelize.Op.in]: convIds }, userId: receiverId },
//         transaction
//       });
//       if (match) {
//         conversation = await Conversation.findByPk(match.conversationId, { transaction });
//       }
//     }

//     if (!conversation) {
//       const follow = await Follower.findOne({
//         where: { followerId: receiverId, followingId: senderId, status: "accepted" },
//         transaction
//       });
//       const isRequest = !follow;

//       conversation = await Conversation.create({ isRequest }, { transaction });
//       await ConversationParticipant.bulkCreate([
//         { conversationId: conversation.id, userId: senderId },
//         { conversationId: conversation.id, userId: receiverId }
//       ], { transaction });
//     }

//     // 4. CREATE MESSAGE (Ab postId save hoga)
//     const message = await Message.create({
//       conversationId: conversation.id,  
//       senderId,
//       receiverId,
//       content: finalType === "shared_post" ? "Shared a post" : content,
//       mediaUrl,
//       type: finalType,
//       postId: postId || null, // 👈 Ye zaroori hai
//       status: "sent"
//     }, { transaction });

//     // 5. UPDATE CONVERSATION PREVIEW
//     const lastMsgPreview = finalType === "shared_post" ? "🔗 Post" : (content || (finalType === "image" ? "📸 Image" : finalType === "audio" ? "🎤 Audio" : "🎬 Video"));
    
//     await conversation.update({ 
//       lastMessage: lastMsgPreview, 
//       lastMessageAt: new Date() 
//     }, { transaction });

//     await transaction.commit();

//     // 6. SOCKET & CACHE (Post-Transaction)
//     const io = getIO();
//     const onlineUsers = getOnlineUsers();
//     const receiverSocketId = onlineUsers.get(receiverId);

//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("receive_message", message);
//       // Delivery status update silently
//       message.update({ status: "delivered" }).catch(e => console.error("Delivered update failed", e));
//     }

//     if (redisClient?.isReady) {
//       await Promise.all([
//         redisClient.del(`conversations:${senderId}`),
//         redisClient.del(`conversations:${receiverId}`)
//       ]);
//     }

//     createNotification({ senderId, receiverId, type: "MESSAGE" }).catch(e => console.error(e));

//     return res.json({ success: true, message });

//   } catch (err) {
//     if (transaction) await transaction.rollback();
//     console.error("🔥 SEND ERROR:", err);
//     return res.status(500).json({ success: false, message: "Send message failed" });
//   }
// };

// // ============================================================
// // MARK SEEN (With Socket & Cache Update)
// // ============================================================

// // Helper function agar validation library nahi hai to
// const validateUUID = (uuid) => {
//   const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//   return re.test(uuid);
// };

// export const markSeen = async (req, res) => {
//   try {
//     const { conversationId } = req.params;
//     const userId = req.user.id;

//     // 🚀 1. Validation check (isUUID fix)
//     if (!validateUUID(conversationId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid conversationId format"
//       });
//     }

//     // 🚀 2. Update Messages Status
//     // Hum un messages ko 'seen' kar rahe hain jo Maine (userId) nahi bheje hain 
//     // Yani jo mere liye 'incoming' hain.
//     await Message.update(
//       { status: "seen" },
//       {
//         where: {
//           conversationId,
//           senderId: { [Op.ne]: userId }, // Jo message maine nahi bheje (Incoming)
//           status: { [Op.ne]: "seen" }    // Jo pehle se seen nahi hain
//         }
//       }
//     );

//     // 🚀 3. Socket.io Real-time Emit
//     try {
//       const io = getIO();
//       if (io) {
//         io.to(conversationId).emit("messages_seen", {
//           conversationId,
//           userId
//         });
//       }
//     } catch (socketErr) {
//       console.error("⚠️ Socket emit failed in markSeen:", socketErr.message);
//       // Socket fail hone par response block nahi karenge
//     }

//     return res.json({ success: true });

//   } catch (err) {
//     console.error("🔥 SEEN ERROR:", err); // Termminal mein check karein
//     return res.status(500).json({ 
//       success: false, 
//       message: "Seen failed",
//       error: err.message 
//     });
//   }
// };



// // ============================================================
// // GET MESSAGES (No Caching for Real-time consistency)
// // ============================================================


// export const getMessages = async (req, res) => {
//   try {
//     const { conversationId } = req.params;

//     // ✅ FIX: isUUID check logic
//     if (!validateUUID(conversationId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid conversationId format"
//       });
//     }

//     const messages = await Message.findAll({
//       where: { conversationId },
//       order: [["createdAt", "ASC"]],
//       include: [
//         {
//           model: Post,
//           as: "post", 
//           attributes: ["id", "mediaUrls", "caption"],
//           required: false, // 👈 IMP: Agar message normal text hai (post nahi), toh bhi message show hoga
//           include: [
//             {
//               model: User,
//               as: "author",
//               attributes: ["id", "username", "profilePhoto"],
//               required: false
//             }
//           ]
//         }
//       ]
//     });

//     return res.json({
//       success: true,
//       count: messages.length,
//       messages
//     });

//   } catch (error) {
//     console.error("🔥 GET MESSAGES ERROR:", error); 
//     // Isse aapko terminal mein exact association error dikh jayega
//     return res.status(500).json({ 
//       success: false, 
//       message: "Failed to fetch messages",
//       error: error.message 
//     });
//   }
// };

// // ... Edit, Delete, Accept/Reject Request remains same but with consistent success:true wrap
// export const editMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const { content } = req.body;
//     const message = await Message.findByPk(messageId);
//     if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

//     await message.update({ content });
//     getIO().to(message.conversationId).emit("message_updated", message);
//     res.json({ success: true, message });
//   } catch (err) { res.status(500).json({ message: "Edit failed" }); }
// };

// export const deleteMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const message = await Message.findByPk(messageId);
//     if (!message || message.senderId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

//     await message.update({ status: "deleted" });
//     getIO().to(message.conversationId).emit("message_deleted", messageId);
//     res.json({ success: true });
//   } catch (err) { res.status(500).json({ message: "Delete failed" }); }
// };

// export const acceptRequest = async (req, res) => {
//   try {
//     const { conversationId } = req.params;
//     const conversation = await Conversation.findByPk(conversationId);
//     if (!conversation) return res.status(404).json({ success: false, message: "Not found" });
//     await conversation.update({ isRequest: false });
//     res.json({ success: true });
//   } catch (error) { res.status(500).json({ success: false }); }
// };

// export const rejectRequest = async (req, res) => {
//   try {
//     await Conversation.destroy({ where: { id: req.params.conversationId } });
//     res.json({ success: true });
//   } catch (error) { res.status(500).json({ success: false }); }
// };

import { Message, Conversation, ConversationParticipant, Follower, User, Post } from "../../models/index.js";
import { getIO, getOnlineUsers } from "../../socket/socket.js";
import { createNotification } from "../../services/notification.service.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";
import sequelize from "../../config/db.js";
import { validate as isUUID } from "uuid";
import { bucket } from "../../config/firebase.js";

const validateUUID = (uuid) => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid);
};

// ============================================================
// SEND MESSAGE
// ============================================================
// message.controller.js - Update sendMessage
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

export const sendMessage = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const senderId = req.user.id;
    const receiverId = req.body.receiverId;
    let { content, type = "text", postId } = req.body;

    // VALIDATION (already present in your code)
    if (!receiverId) return res.status(400).json({ success: false, message: "Receiver required" });

    let mediaUrl = null;
    let thumbnail = null; // 🔥 Add this
    let finalType = type;

    // 📂 GCS FILE UPLOAD + THUMBNAIL LOGIC
    if (req.file) {
      const fileName = `chat_media/chat_${Date.now()}_${req.file.originalname}`;
      const blob = bucket.file(fileName);
      await blob.save(req.file.buffer, { metadata: { contentType: req.file.mimetype } });
      mediaUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      const mime = req.file.mimetype;
      if (mime.startsWith("image")) finalType = "image";
      else if (mime.startsWith("audio")) finalType = "audio";
      else if (mime.startsWith("video")) {
        finalType = "video";
        // 🔥 Generate Thumbnail for Video
        try {
          const tempVideoPath = path.join(os.tmpdir(), `chat_temp_${Date.now()}.mp4`);
          const tempThumbPath = path.join(os.tmpdir(), `chat_thumb_${Date.now()}.jpg`);
          fs.writeFileSync(tempVideoPath, req.file.buffer);

          await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
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

          const thumbFileName = `chat_thumbnails/thumb_${Date.now()}.jpg`;
          const thumbBlob = bucket.file(thumbFileName);
          await thumbBlob.save(fs.readFileSync(tempThumbPath));
          thumbnail = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;

          // Cleanup
          if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
          if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
        } catch (e) { console.error("Thumbnail failed", e); }
      }
      content = null;
    }

    // (Conversation Find/Create Logic same as yours)
    // ...

    // 4. CREATE MESSAGE with Thumbnail
    const message = await Message.create({
      conversationId: conversation.id,
      senderId,
      receiverId,
      content: finalType === "shared_post" ? "Shared a post" : content,
      mediaUrl,
      thumbnail, // 🔥 Save here
      type: finalType,
      postId: postId || null,
      status: "sent"
    }, { transaction });

    // Update conversation preview and commit...
    await transaction.commit();

    // Socket Emit and Invalidate Cache...
    // (Logic remains same)
    const messageData = message.toJSON();

// 🚀 REDIS CACHE INVALIDATION (Add this specifically)
if (redisClient?.isReady) {
  // Dono users ki inbox cache delete karein taaki unhe fresh list mile
  Promise.all([
    redisClient.del(`conversations:${senderId}`),
    redisClient.del(`conversations:${receiverId}`)
  ]).then(() => {
    console.log("🧹 Inbox cache cleared for both users");
  }).catch(e => console.error("Cache clear failed:", e));
}

    return res.json({ success: true, message: message.toJSON() });
  } catch (err) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: "Send failed" });
  }
};

// ============================================================
// MARK SEEN
// ============================================================
// message.controller.js
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
          senderId: { [Op.ne]: userId }, // Mere liye aaye hue messages
          status: { [Op.ne]: "seen" }
        }
      }
    );

    // 🚀 2. ZAROORI: Redis Cache Clear (Inbox refresh ke liye)
    // Agar messages seen hue hain, toh inbox ki cache saaf karni hogi
    if (updatedCount > 0 && redisClient?.isReady) {
      await redisClient.del(`conversations:${userId}`);
      // console.log(`🧹 Cache cleared for user: ${userId} after marking seen`);
    }

    // 3. Socket emit for real-time double tick (Blue tick)
    try {
      const io = getIO();
      if (io) {
        // Sender ko batao ki uske messages dekh liye gaye hain
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
      return res.status(400).json({ success: false, message: "Invalid conversationId format" });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Post,
          as: "post",
          // 🔥 Yahan 'thumbnail' add kar diya hai
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

    return res.json({ success: true, count: messages.length, messages });

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
    const message = await Message.findByPk(messageId);

    if (!message || message.senderId !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await message.update({ content });

    try {
      getIO().to(message.conversationId).emit("message_updated", message.toJSON());
    } catch (e) {
      console.error("Socket emit failed:", e.message);
    }

    res.json({ success: true, message });
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