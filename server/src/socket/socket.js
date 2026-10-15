
// import { Server } from "socket.io";
// import { ConversationParticipant } from "../models/index.js";

// let io = null;
// const onlineUsers = new Map();

// export const initSocket = (server) => {
//   io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//       credentials: true
//     },
//     transports: ["websocket", "polling"],
//     allowEIO3: true,
//     pingTimeout: 60000,
//     pingInterval: 25000
//   });

//   io.on("connection", (socket) => {

//   try {

//     console.log("⚡ New Socket Connection:", socket.id);

//     // =========================================
//     // ✅ REGISTER USER
//     // =========================================

//     socket.on("register", async (userId) => {

//       try {

//         if (!userId) {
//           console.log("❌ Invalid userId");
//           return;
//         }

//         // Latest socket map
//         onlineUsers.set(userId, socket.id);

//         socket.userId = userId;

//         // =========================================
//         // ✅ AUTO JOIN CONVERSATIONS
//         // =========================================

//         try {

//           const entries =
//             await ConversationParticipant.findAll({

//               where: { userId },

//               attributes: ["conversationId"],

//               raw: true
//             });

//           entries.forEach(({ conversationId }) => {

//             socket.join(conversationId);
//           });

//         } catch (err) {

//           console.error(
//             "❌ Auto-join failed:",
//             err.message
//           );
//         }

//         // =========================================
//         // ✅ PERSONAL ROOM
//         // =========================================

//         socket.join(`user_${userId}`);

//         console.log(
//           `✅ User registered: ${userId}`
//         );

//       } catch (err) {

//         console.error(
//           "❌ Register socket error:",
//           err
//         );
//       }
//     });

//     // =========================================
//     // ✅ JOIN CONVERSATION
//     // =========================================

//     socket.on(
//       "join_conversation",
//       (conversationId) => {

//         try {

//           if (!conversationId) return;

//           socket.join(conversationId);

//           console.log(
//             `🏠 Joined room: ${conversationId}`
//           );

//         } catch (err) {

//           console.error(
//             "❌ Join room error:",
//             err
//           );
//         }
//       }
//     );

//     // =========================================
//     // ✅ LEAVE CONVERSATION
//     // =========================================

//     socket.on(
//       "leave_conversation",
//       (conversationId) => {

//         try {

//           if (!conversationId) return;

//           socket.leave(conversationId);

//           console.log(
//             `🚪 Left room: ${conversationId}`
//           );

//         } catch (err) {

//           console.error(
//             "❌ Leave room error:",
//             err
//           );
//         }
//       }
//     );

//     // =========================================
//     // ✅ TYPING
//     // =========================================

//     socket.on(
//       "typing",
//       ({ conversationId, userId }) => {

//         try {

//           socket
//             .to(conversationId)
//             .emit("typing", { userId });

//         } catch (err) {

//           console.error(
//             "❌ Typing event error:",
//             err
//           );
//         }
//       }
//     );

//     // =========================================
//     // ✅ STOP TYPING
//     // =========================================

//     socket.on(
//       "stop_typing",
//       ({ conversationId, userId }) => {

//         try {

//           socket
//             .to(conversationId)
//             .emit("stop_typing", { userId });

//         } catch (err) {

//           console.error(
//             "❌ Stop typing error:",
//             err
//           );
//         }
//       }
//     );

//     // =========================================
//     // ✅ SOCKET CONNECT ERROR
//     // =========================================

//     socket.on("connect_error", (err) => {

//       console.error(
//         "❌ Socket Connect Error:",
//         err.message
//       );
//     });

//     // =========================================
//     // ✅ DISCONNECT
//     // =========================================

//     socket.on("disconnect", (reason) => {

//       try {

//         console.log(
//           `🔌 User Disconnected: ${socket.id}`
//         );

//         console.log(`Reason: ${reason}`);

//         for (
//           let [userId, sockId]
//           of onlineUsers.entries()
//         ) {

//           if (sockId === socket.id) {

//             onlineUsers.delete(userId);

//             break;
//           }
//         }

//       } catch (err) {

//         console.error(
//           "❌ Disconnect cleanup error:",
//           err
//         );
//       }
//     });

//   } catch (err) {

//     console.error(
//       "🔥 SOCKET CONNECTION ERROR:",
//       err
//     );
//   }
// });

//   return io;
// };

// export const getIO = () => {
//   if (!io) throw new Error("Socket.io not initialized!");
//   return io;
// };

// export const getOnlineUsers = () => onlineUsers;
import { Server } from "socket.io";
import { Op } from "sequelize";
import { ConversationParticipant } from "../models/index.js";

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
      // ✅ REGISTER USER
      // =========================================
      socket.on("register", async (userId) => {
        try {
          if (!userId) {
            console.log("❌ Invalid userId");
            return;
          }

          onlineUsers.set(userId, socket.id);
          socket.userId = userId;

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

          console.log(`✅ User registered: ${userId}`);
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
      // ✅ DISCONNECT
      // =========================================
      socket.on("disconnect", (reason) => {
        try {
          console.log(`🔌 User Disconnected: ${socket.id}`);
          console.log(`Reason: ${reason}`);

          for (let [userId, sockId] of onlineUsers.entries()) {
            if (sockId === socket.id) {
              onlineUsers.delete(userId);
              break;
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