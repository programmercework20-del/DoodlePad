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
    console.log("⚡ New Socket Connection:", socket.id);

    // ✅ Register user
    socket.on("register", (userId) => {
      if (userId) {
        onlineUsers.set(userId, socket.id);
        console.log(`👤 User Registered: ${userId} with Socket: ${socket.id}`);
        console.log(`📈 Online Users Count: ${onlineUsers.size}`);
      }
    });

    // 🔥 FIX 1: Conversation room join karo
    socket.on("join_conversation", (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`🏠 Socket ${socket.id} joined room: ${conversationId}`);
      }
    });

    // 🔥 FIX 2: Conversation room leave karo
    socket.on("leave_conversation", (conversationId) => {
      if (conversationId) {
        socket.leave(conversationId);
        console.log(`🚪 Socket ${socket.id} left room: ${conversationId}`);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket Connect Error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 User Disconnected: ${socket.id} (Reason: ${reason})`);
      for (let [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export const getOnlineUsers = () => onlineUsers;