// conversation.controller.js
import { Message, Conversation, ConversationParticipant, User } from "../../models/index.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";
import Block from "../../models/Block.js";


export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `conversations:${userId}`;

    // 🚀 1. Redis Cache Check (Fastest Path)
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        // console.log("🟢 Serving from Redis Cache");
        return res.json({ success: true, conversations: JSON.parse(cachedData) });
      }
    }

    // 🔥 2. FETCH ALL BLOCKS IN ONE GO (Optimization)
    const myBlocks = await Block.findAll({
      where: {
        [Op.or]: [{ blockerId: userId }, { blockedId: userId }]
      },
      raw: true
    });

    // Create fast lookup Sets for O(1) performance
    const usersIBlocked = new Set(myBlocks.filter(b => b.blockerId === userId).map(b => b.blockedId));
    const usersWhoBlockedMe = new Set(myBlocks.filter(b => b.blockedId === userId).map(b => b.blockerId));

    // 🚀 3. Fetch Conversation IDs for the User
    const participantEntries = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ['conversationId'],
      raw: true
    });

    const conversationIds = participantEntries.map(p => p.conversationId);

    if (conversationIds.length === 0) {
      return res.json({ success: true, conversations: [] });
    }

    // 🚀 4. Fetch Full Details with Participants
    const conversations = await Conversation.findAll({
      where: { id: { [Op.in]: conversationIds } },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "profilePhoto"]
            }
          ]
        }
      ],
      order: [["lastMessageAt", "DESC"]],
      limit: 50 
    });

    // 🚀 5. Format Result with Block Flags, Media Data, Unread Count & IST Time
    const result = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const otherUser = otherParticipant ? otherParticipant.user : null;
      const otherUserId = otherUser ? otherUser.id : null;

      // Unread count nikal rahe hain
      const unreadCount = await Message.count({
        where: {
          conversationId: conv.id,
          receiverId: userId,
          status: { [Op.ne]: "seen" }
        }
      });

      // 🔥 Last message ki type, mediaUrl aur duration fetch karne ke liye
      const latestMessage = await Message.findOne({
        where: { conversationId: conv.id },
        order: [["createdAt", "DESC"]],
        attributes: ["type", "mediaUrl", "duration", "content"]
      });

      // 🔥 IST Time Formatting Logic (12-hour format)
      const istTime = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true // Ye 6:15 PM format mein convert karega
      }).format(new Date(conv.lastMessageAt));

      // 🔥 Expected Response Format mapping
      return {
        id: conv.id,
        lastMessage: conv.lastMessage || latestMessage?.content || "Start chatting...",
        lastMessageAt: istTime, 
        unreadCount,
        isRequest: conv.isRequest,
        user: otherUser,
        
        // Media payload fields
        type: latestMessage?.type || "text",
        mediaUrl: latestMessage?.mediaUrl || null,
        duration: latestMessage?.duration || null,

        // 🔥 NAYE FLAGS FE DEV KE LIYE (Block Logic):
        isBlockedByMe: otherUserId ? usersIBlocked.has(otherUserId) : false,
        hasBlockedMe: otherUserId ? usersWhoBlockedMe.has(otherUserId) : false
      };
    }));

    const finalResult = result.filter(c => c.user !== null);

    // 🚀 6. Set Redis Cache
    if (redisClient?.isReady && finalResult.length > 0) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(finalResult));
    }

    return res.json({ 
      success: true, 
      conversations: finalResult 
    });

  } catch (err) {
    console.error("🔥 CONVERSATION ERROR:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to load conversations" 
    });
  }
};



// export const getConversations = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const cacheKey = `conversations:${userId}`;

//     // 🚀 1. Redis Cache Check (Fastest Path)
//     if (redisClient?.isReady) {
//       const cachedData = await redisClient.get(cacheKey);
//       if (cachedData) {
//         // console.log("🟢 Serving from Redis Cache");
//         return res.json({ success: true, conversations: JSON.parse(cachedData) });
//       }
//     }

//     // 🚀 2. Fetch Conversation IDs for the User
//     const participantEntries = await ConversationParticipant.findAll({
//       where: { userId },
//       attributes: ['conversationId'],
//       raw: true
//     });

//     const conversationIds = participantEntries.map(p => p.conversationId);

//     if (conversationIds.length === 0) {
//       return res.json({ success: true, conversations: [] });
//     }

//     // 🚀 3. Fetch Full Details with Participants
//     const conversations = await Conversation.findAll({
//       where: { id: { [Op.in]: conversationIds } },
//       include: [
//         {
//           model: ConversationParticipant,
//           as: "participants",
//           include: [
//             {
//               model: User,
//               as: "user",
//               attributes: ["id", "username", "profilePhoto"]
//             }
//           ]
//         }
//       ],
//       order: [["lastMessageAt", "DESC"]],
//       limit: 50 
//     });

//    // 🚀 4. Format Result with dynamic Unread Count & IST Time
// const result = await Promise.all(conversations.map(async (conv) => {
//   const otherParticipant = conv.participants.find(p => p.userId !== userId);
//   const otherUser = otherParticipant ? otherParticipant.user : null;

//   const unreadCount = await Message.count({
//     where: {
//       conversationId: conv.id,
//       receiverId: userId,
//       status: { [Op.ne]: "seen" }
//     }
//   });

//   // 🔥 IST Time Formatting Logic (12-hour format)
//   const istTime = new Intl.DateTimeFormat('en-IN', {
//     timeZone: 'Asia/Kolkata',
//     hour: 'numeric',
//     minute: 'numeric',
//     hour12: true // Ye 6:15 PM format mein convert karega
//   }).format(new Date(conv.lastMessageAt));

//   return {
//     id: conv.id,
//     lastMessage: conv.lastMessage || "Start chatting...",
//     lastMessageAt: istTime, // Ab ye "6:15 PM" jaisa dikhega
//     unreadCount,
//     isRequest: conv.isRequest,
//     user: otherUser
//   };
// }));

//     const finalResult = result.filter(c => c.user !== null);

//     // 🚀 5. Set Redis Cache
//     // Inbox ke liye 30-60 seconds expiry best hai taaki counts bohot purane na lagein
//     if (redisClient?.isReady && finalResult.length > 0) {
//       await redisClient.setEx(cacheKey, 60, JSON.stringify(finalResult));
//       // console.log("🔴 Cache Miss: Data saved to Redis for 60s");
//     }

//     return res.json({ 
//       success: true, 
//       conversations: finalResult 
//     });

//   } catch (err) {
//     console.error("🔥 CONVERSATION ERROR:", err);
//     return res.status(500).json({ 
//       success: false, 
//       message: "Failed to load conversations" 
//     });
//   }
// };