import { 
  Conversation, 
  ConversationParticipant, 
  User,
  sequelize // <--- 1. YAHAN SEQUELIZE IMPORT KIYA (Zaruri hai)
} from "../../models/index.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";

// ============================================================
// GET CONVERSATIONS (Inbox List with Redis & DB Filtering)
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

    // 🚀 2. DB Level Filtering (Optimized)
    // Hum sirf wahi conversations nikal rahe hain jahan user khud participant hai
    const conversations = await Conversation.findAll({
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          required: true, 
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "profilePhoto"]
            }
          ],
          // 🔥 FIXED: Subquery logic with literal fix
          where: {
            conversationId: {
              [Op.in]: [
                sequelize.literal(`(SELECT "conversationId" FROM "ConversationParticipants" WHERE "userId" = '${userId}')`)
              ]
            }
          }
        }
      ],
      where: {
        // Optional logic (active/deleted status) can go here
      },
      order: [["lastMessageAt", "DESC"]],
      limit: 50 
    });

    // 3. Format result (Find "Other User")
    const result = conversations.map(conv => {
      // Participants mein se wo user dhoondo jo 'main' nahi hoon
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const otherUser = otherParticipant ? otherParticipant.user : null;

      // 🔥 Added safety check for empty mediaUrls/lastMessage logic
      return {
        id: conv.id,
        lastMessage: conv.lastMessage || "Start chatting...",
        lastMessageAt: conv.lastMessageAt,
        isRequest: conv.isRequest,
        user: otherUser
      };
    }).filter(c => c.user !== null); // Filter out empty or broken convs

    // 🚀 4. Set Redis Cache (Short lived - 2 minutes)
    if (redisClient?.isReady && result.length > 0) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(result));
    }

    return res.json({ 
      success: true, 
      conversations: result 
    });

  } catch (err) {
    console.error("🔥 CONVERSATION ERROR:", err);
    // Yahan log mein check karein agar 'sequelize is not defined' abhi bhi aa raha ho
    return res.status(500).json({ 
      success: false, 
      message: "Failed to load conversations",
      error: err.message // Error message debug karne ke liye
    });
  }
};