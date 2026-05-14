// conversation.controller.js
import { Message, Conversation, ConversationParticipant, User } from "../../models/index.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";

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

    // 🚀 2. Fetch Conversation IDs for the User
    const participantEntries = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ['conversationId'],
      raw: true
    });

    const conversationIds = participantEntries.map(p => p.conversationId);

    if (conversationIds.length === 0) {
      return res.json({ success: true, conversations: [] });
    }

    // 🚀 3. Fetch Full Details with Participants
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

   // 🚀 4. Format Result with dynamic Unread Count & IST Time
const result = await Promise.all(conversations.map(async (conv) => {
  const otherParticipant = conv.participants.find(p => p.userId !== userId);
  const otherUser = otherParticipant ? otherParticipant.user : null;

  const unreadCount = await Message.count({
    where: {
      conversationId: conv.id,
      receiverId: userId,
      status: { [Op.ne]: "seen" }
    }
  });

  // 🔥 IST Time Formatting Logic (12-hour format)
  const istTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true // Ye 6:15 PM format mein convert karega
  }).format(new Date(conv.lastMessageAt));

  return {
    id: conv.id,
    lastMessage: conv.lastMessage || "Start chatting...",
    lastMessageAt: istTime, // Ab ye "6:15 PM" jaisa dikhega
    unreadCount,
    isRequest: conv.isRequest,
    user: otherUser
  };
}));

    const finalResult = result.filter(c => c.user !== null);

    // 🚀 5. Set Redis Cache
    // Inbox ke liye 30-60 seconds expiry best hai taaki counts bohot purane na lagein
    if (redisClient?.isReady && finalResult.length > 0) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(finalResult));
      // console.log("🔴 Cache Miss: Data saved to Redis for 60s");
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