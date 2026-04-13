import { Server } from "socket.io";

let io = null;
const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // ✅ Register user
    socket.on("register", (userId) => {
      onlineUsers.set(userId, socket.id);
    });

    // ✅ Disconnect cleanup
    socket.on("disconnect", () => {
      for (let [userId, sockId] of onlineUsers) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
    });
  });
};

export const getIO = () => io;
export const getOnlineUsers = () => onlineUsers;