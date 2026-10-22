import { Message, Conversation, ConversationParticipant, User } from "../../models/index.js";
import { Op } from "sequelize";
import redisClient from "../../config/redis.js";
import Block from "../../models/Block.js";

export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    // 🔥 Bumped cache key to v2 so old cached items without conversationId/receiverId are ignored
    const cacheKey = `conversations:v2:${userId}`;

    // 🚀 1. Redis Cache Check (Fastest Path)
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
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

    const usersIBlocked = new Set(myBlocks.filter(b => b.blockerId === userId).map(b => b.blockedId));
    const usersWhoBlockedMe = new Set(myBlocks.filter(b => b.blockedId === userId).map(b => b.blockerId));

    // 🚀 3. Fetch Conversation IDs for the User
    const participantEntries = await ConversationParticipant.findAll({
      where: { userId },
      attributes: ["conversationId"],
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
          attributes: ["id", "userId"], // Junction table mein bas ID chahiye
          include: [
            {
              model: User,
              as: "user",
              // 🔥 YAHAN ADD KARNA HAI ASLI USER KA DATA:
              attributes: ["id", "username", "profilePhoto", "isOnline", "lastSeen"]
            }
          ]
        }
      ],
      order: [["lastMessageAt", "DESC"]],
      limit: 50
    });

    // 🚀 5. Format Result with Explicit IDs, Block Flags, Media Data, Unread Count & IST Time
    const result = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const otherUser = otherParticipant ? otherParticipant.user : null;
      const otherUserId = otherUser ? otherUser.id : null;

      const unreadCount = await Message.count({
        where: {
          conversationId: conv.id,
          receiverId: userId,
          status: { [Op.ne]: "seen" }
        }
      });

      const latestMessage = await Message.findOne({
        where: { conversationId: conv.id },
        order: [["createdAt", "DESC"]],
        attributes: ["type", "mediaUrl", "duration", "content"]
      });

      const istTime = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: true
      }).format(new Date(conv.lastMessageAt));

      return {
        id: conv.id,
        conversationId: conv.id, // 🔥 Explicit conversationId so FE never confuses it with user.id
        receiverId: otherUserId, // 🔥 Explicit receiverId for ChatScreen & sendMessage
        recipientId: otherUserId,
        peerId: otherUserId,
        lastMessage: conv.lastMessage || latestMessage?.content || "Start chatting...",
        lastMessageAt: istTime,
        unreadCount,
        isRequest: conv.isRequest,
        user: otherUser,

        // Media payload fields
        type: latestMessage?.type || "text",
        mediaUrl: latestMessage?.mediaUrl || null,
        duration: latestMessage?.duration || null,

        // Block Logic Flags
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