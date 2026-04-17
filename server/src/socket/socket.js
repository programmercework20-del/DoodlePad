import { Server } from "socket.io";

let io = null;
const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Testing ke liye thik hai, production mein app ka domain daal sakte ho
      methods: ["GET", "POST"],
      credentials: true
    },
    // 🚀 MOBILE APP FIX: In settings ke bina Android/iOS mein connection errors aate hain
    transports: ["websocket", "polling"], 
    allowEIO3: true, // Legacy support ke liye
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on("connection", (socket) => {
    console.log("⚡ New Socket Connection:", socket.id);

    // ✅ Register user with validation
    socket.on("register", (userId) => {
      if (userId) {
        onlineUsers.set(userId, socket.id);
        console.log(`👤 User Registered: ${userId} with Socket: ${socket.id}`);
        // Online users count check karne ke liye
        console.log(`📈 Online Users Count: ${onlineUsers.size}`);
      }
    });

    // ✅ Error handling
    socket.on("connect_error", (err) => {
      console.error("❌ Socket Connect Error:", err.message);
    });

    // ✅ Disconnect cleanup (Optimized)
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

// Helper to get IO instance
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

// Helper to get online users map
export const getOnlineUsers = () => onlineUsers;