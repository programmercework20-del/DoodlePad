// import { Server } from "socket.io";

// let io = null;
// const onlineUsers = new Map();

// export const initSocket = (server) => {
//   io = new Server(server, {
//     cors: {
//       origin: "*", // Testing ke liye thik hai, production mein app ka domain daal sakte ho
//       methods: ["GET", "POST"],
//       credentials: true
//     },
//     // 🚀 MOBILE APP FIX: In settings ke bina Android/iOS mein connection errors aate hain
//     transports: ["websocket", "polling"], 
//     allowEIO3: true, // Legacy support ke liye
//     pingTimeout: 60000,
//     pingInterval: 25000
//   });

//   io.on("connection", (socket) => {
//     console.log("⚡ New Socket Connection:", socket.id);

//     // ✅ Register user with validation
//     socket.on("register", (userId) => {
//       if (userId) {
//         onlineUsers.set(userId, socket.id);
//         console.log(`👤 User Registered: ${userId} with Socket: ${socket.id}`);
//         // Online users count check karne ke liye
//         console.log(`📈 Online Users Count: ${onlineUsers.size}`);
//       }
//     });

//     // ✅ Error handling
//     socket.on("connect_error", (err) => {
//       console.error("❌ Socket Connect Error:", err.message);
//     });

//     // ✅ Disconnect cleanup (Optimized)
//     socket.on("disconnect", (reason) => {
//       console.log(`🔌 User Disconnected: ${socket.id} (Reason: ${reason})`);
//       for (let [userId, sockId] of onlineUsers.entries()) {
//         if (sockId === socket.id) {
//           onlineUsers.delete(userId);
//           break;
//         }
//       }
//     });
//   });

//   return io;
// };

// // Helper to get IO instance
// export const getIO = () => {
//   if (!io) {
//     throw new Error("Socket.io not initialized!");
//   }
//   return io;
// };

// // Helper to get online users map
// export const getOnlineUsers = () => onlineUsers;


import { Server } from "socket.io";
import { ConversationParticipant } from "../models/index.js";

let io = null;
const onlineUsers = new Map();

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

        // Latest socket map
        onlineUsers.set(userId, socket.id);

        socket.userId = userId;

        // =========================================
        // ✅ AUTO JOIN CONVERSATIONS
        // =========================================

        try {

          const entries =
            await ConversationParticipant.findAll({

              where: { userId },

              attributes: ["conversationId"],

              raw: true
            });

          entries.forEach(({ conversationId }) => {

            socket.join(conversationId);
          });

        } catch (err) {

          console.error(
            "❌ Auto-join failed:",
            err.message
          );
        }

        // =========================================
        // ✅ PERSONAL ROOM
        // =========================================

        socket.join(`user_${userId}`);

        console.log(
          `✅ User registered: ${userId}`
        );

      } catch (err) {

        console.error(
          "❌ Register socket error:",
          err
        );
      }
    });

    // =========================================
    // ✅ JOIN CONVERSATION
    // =========================================

    socket.on(
      "join_conversation",
      (conversationId) => {

        try {

          if (!conversationId) return;

          socket.join(conversationId);

          console.log(
            `🏠 Joined room: ${conversationId}`
          );

        } catch (err) {

          console.error(
            "❌ Join room error:",
            err
          );
        }
      }
    );

    // =========================================
    // ✅ LEAVE CONVERSATION
    // =========================================

    socket.on(
      "leave_conversation",
      (conversationId) => {

        try {

          if (!conversationId) return;

          socket.leave(conversationId);

          console.log(
            `🚪 Left room: ${conversationId}`
          );

        } catch (err) {

          console.error(
            "❌ Leave room error:",
            err
          );
        }
      }
    );

    // =========================================
    // ✅ TYPING
    // =========================================

    socket.on(
      "typing",
      ({ conversationId, userId }) => {

        try {

          socket
            .to(conversationId)
            .emit("typing", { userId });

        } catch (err) {

          console.error(
            "❌ Typing event error:",
            err
          );
        }
      }
    );

    // =========================================
    // ✅ STOP TYPING
    // =========================================

    socket.on(
      "stop_typing",
      ({ conversationId, userId }) => {

        try {

          socket
            .to(conversationId)
            .emit("stop_typing", { userId });

        } catch (err) {

          console.error(
            "❌ Stop typing error:",
            err
          );
        }
      }
    );

    // =========================================
    // ✅ SOCKET CONNECT ERROR
    // =========================================

    socket.on("connect_error", (err) => {

      console.error(
        "❌ Socket Connect Error:",
        err.message
      );
    });

    // =========================================
    // ✅ DISCONNECT
    // =========================================

    socket.on("disconnect", (reason) => {

      try {

        console.log(
          `🔌 User Disconnected: ${socket.id}`
        );

        console.log(`Reason: ${reason}`);

        for (
          let [userId, sockId]
          of onlineUsers.entries()
        ) {

          if (sockId === socket.id) {

            onlineUsers.delete(userId);

            break;
          }
        }

      } catch (err) {

        console.error(
          "❌ Disconnect cleanup error:",
          err
        );
      }
    });

  } catch (err) {

    console.error(
      "🔥 SOCKET CONNECTION ERROR:",
      err
    );
  }
});

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export const getOnlineUsers = () => onlineUsers;