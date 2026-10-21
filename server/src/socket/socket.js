import { Server } from "socket.io";
import { Op } from "sequelize";
import { ConversationParticipant, User } from "../models/index.js";

let io = null;
const onlineUsers = new Map();

// 🔥 Helper: Resolve real conversationId if FE passes a peer userId to socket events
const resolveSocketConversationRoom = async (currentUserId, rawRoomId) => {
  if (!currentUserId || !rawRoomId) return null;
  try {
    // Check if rawRoomId is already a conversation the user belongs to
    const direct = await ConversationParticipant.findOne({
      where: { conversationId: rawRoomId, userId: currentUserId },
      attributes: ["conversationId"],
      raw: true
    });
    if (direct) return direct.conversationId;

    // Otherwise check if rawRoomId is another User's ID and find shared conversation
    const myConvs = await ConversationParticipant.findAll({
      where: { userId: currentUserId },
      attributes: ["conversationId"],
      raw: true
    });
    const convIds = myConvs.map(c => c.conversationId);
    if (convIds.length === 0) return null;

    const shared = await ConversationParticipant.findOne({
      where: {
        conversationId: { [Op.in]: convIds },
        userId: rawRoomId
      },
      attributes: ["conversationId"],
      raw: true
    });

    return shared ? shared.conversationId : null;
  } catch (e) {
    return null;
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on("connection", (socket) => {
    try {
      console.log("⚡ New Socket Connection:", socket.id);

      // =========================================
      // ✅ REGISTER USER (PRO Multi-Device Logic)
      // =========================================
      socket.on("register", async (userId) => {
        try {
          if (!userId) {
            console.log("❌ Invalid userId");
            return;
          }

          socket.userId = userId;

          // 🔥 Multi-device handling
          if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set([socket.id]));
            
            // Database me user ko online karo (Sequelize)
            if (User) {
              await User.update({ isOnline: true }, { where: { id: userId } });
            }
            
            // Sabko batao user online aa gaya
            io.emit("update_user_status", { userId, isOnline: true });
          } else {
            // Agar user kisi aur device par hai, bas naya socket id add karo
            onlineUsers.get(userId).add(socket.id);
          }

          // Auto-join all existing conversations
          try {
            const entries = await ConversationParticipant.findAll({
              where: { userId },
              attributes: ["conversationId"],
              raw: true
            });

            entries.forEach(({ conversationId }) => {
              socket.join(conversationId);
            });
          } catch (err) {
            console.error("❌ Auto-join failed:", err.message);
          }

          // Join both user_<id> and raw <id> rooms for maximum compatibility
          socket.join(`user_${userId}`);
          socket.join(userId);

          console.log(`✅ User registered: ${userId} on Socket: ${socket.id}`);
        } catch (err) {
          console.error("❌ Register socket error:", err);
        }
      });

      // =========================================
      // ✅ JOIN CONVERSATION (With Auto-Heal for User ID)
      // =========================================
      socket.on("join_conversation", async (conversationId) => {
        try {
          if (!conversationId) return;

          socket.join(conversationId);
          console.log(`🏠 Joined room: ${conversationId}`);

          // 🔥 If FE sent peer's userId instead of conversationId, also join real conversationId!
          if (socket.userId) {
            const realConvId = await resolveSocketConversationRoom(socket.userId, conversationId);
            if (realConvId && realConvId !== conversationId) {
              socket.join(realConvId);
              console.log(`🔗 Auto-joined mapped conversation room: ${realConvId}`);
            }
          }
        } catch (err) {
          console.error("❌ Join room error:", err);
        }
      });

      // =========================================
      // ✅ LEAVE CONVERSATION
      // =========================================
      socket.on("leave_conversation", (conversationId) => {
        try {
          if (!conversationId) return;
          socket.leave(conversationId);
          console.log(`🚪 Left room: ${conversationId}`);
        } catch (err) {
          console.error("❌ Leave room error:", err);
        }
      });

      // =========================================
      // ✅ TYPING
      // =========================================
      socket.on("typing", async ({ conversationId, userId }) => {
        try {
          if (!conversationId) return;
          socket.to(conversationId).emit("typing", { userId });

          const realConvId = await resolveSocketConversationRoom(userId || socket.userId, conversationId);
          if (realConvId && realConvId !== conversationId) {
            socket.to(realConvId).emit("typing", { userId });
          }
        } catch (err) {
          console.error("❌ Typing event error:", err);
        }
      });

      // =========================================
      // ✅ STOP TYPING
      // =========================================
      socket.on("stop_typing", async ({ conversationId, userId }) => {
        try {
          if (!conversationId) return;
          socket.to(conversationId).emit("stop_typing", { userId });

          const realConvId = await resolveSocketConversationRoom(userId || socket.userId, conversationId);
          if (realConvId && realConvId !== conversationId) {
            socket.to(realConvId).emit("stop_typing", { userId });
          }
        } catch (err) {
          console.error("❌ Stop typing error:", err);
        }
      });

      // =========================================
      // ✅ SOCKET CONNECT ERROR
      // =========================================
      socket.on("connect_error", (err) => {
        console.error("❌ Socket Connect Error:", err.message);
      });

      // =========================================
      // ✅ DISCONNECT (PRO Offline Logic)
      // =========================================
      socket.on("disconnect", async (reason) => {
        try {
          console.log(`🔌 User Disconnected: ${socket.id} | Reason: ${reason}`);
          
          const userId = socket.userId;
          if (userId && onlineUsers.has(userId)) {
            const userSockets = onlineUsers.get(userId);
            userSockets.delete(socket.id); // Ye wala device delete karo

            // Agar user ne saare devices band kar diye tabhi offline dikhao
            if (userSockets.size === 0) {
              onlineUsers.delete(userId);
              const lastSeenTime = new Date();

              // Database me offline karo aur last seen time dalo (Sequelize)
              if (User) {
                await User.update({ 
                  isOnline: false, 
                  lastSeen: lastSeenTime 
                }, { where: { id: userId } });
              }

              // Sabko batao ki user offline gaya
              io.emit("update_user_status", { 
                userId, 
                isOnline: false, 
                lastSeen: lastSeenTime 
              });
            }
          }
        } catch (err) {
          console.error("❌ Disconnect cleanup error:", err);
        }
      });

    } catch (err) {
      console.error("🔥 SOCKET CONNECTION ERROR:", err);
    }
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export const getOnlineUsers = () => onlineUsers;