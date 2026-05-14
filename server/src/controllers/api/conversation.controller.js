import { 
  Conversation, 
  ConversationParticipant, 
  User 
} from "../../models/index.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";

// ============================================================
// GET CONVERSATIONS (Inbox List - Fixed Table Name & Logic)
// ============================================================
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `conversations:${userId}`;

    // 🚀 1. Redis Cache Check
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.json({ success: true, conversations: JSON.parse(cachedData) });
      }
    }

    // 🚀 2. Fetch Conversation IDs for the User
    // Hum Sequelize model ka use kar rahe hain taaki tableName ka koi lafada na ho
    const participantEntries = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ['conversationId'],
      raw: true
    });

    const conversationIds = participantEntries.map(p => p.conversationId);

    // Agar koi conversation nahi mili, toh khali array bhej do
    if (conversationIds.length === 0) {
      return res.json({ success: true, conversations: [] });
    }

    // 🚀 3. Fetch Full Details with Participants and User Info
    const conversations = await Conversation.findAll({
      where: {
        id: { [Op.in]: conversationIds }
      },
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

    // 🚀 4. Format Result (Identify "Other User")
    const result = conversations.map(conv => {
      // Khud ko chhod kar dusre participant ko dhoondo
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const otherUser = otherParticipant ? otherParticipant.user : null;

      return {
        id: conv.id,
        lastMessage: conv.lastMessage || "Start chatting...",
        lastMessageAt: conv.lastMessageAt,
        isRequest: conv.isRequest,
        user: otherUser
      };
    }).filter(c => c.user !== null); // Sirf wahi dikhao jisme user mil jaye

    // 🚀 5. Set Redis Cache (2 minutes expiry)
    if (redisClient?.isReady && result.length > 0) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(result));
    }

    return res.json({ 
      success: true, 
      conversations: result 
    });

  } catch (err) {
    console.error("🔥 CONVERSATION ERROR:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to load conversations" 
    });
  }
};