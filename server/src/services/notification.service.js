import Notification from "../models/Notification.js";
import { getIO, getOnlineUsers } from "../socket/socket.js";
import User from "../models/User.js";
import { sendPushNotification } from "./push.services.js";

export const createNotification = async ({
  senderId,
  receiverId,
  type,
  postId = null,
  commentId = null,
  doodleRequestId = null
}) => {
  try {
    if (senderId === receiverId) return null;

    const notification = await Notification.create({
      senderId,
      receiverId,
      type,
      postId,
      commentId,
      doodleRequestId,
      isRead: false
    });

    const sender = await User.findByPk(senderId, {
      attributes: ["id", "username", "profilePhoto"]
    });

    const payload = {
      ...notification.toJSON(),
      sender
    };

    // 🔥 SOCKET (APP OPEN)
    const io = getIO();
    const onlineUsers = getOnlineUsers();
    const socketId = onlineUsers.get(receiverId);

    if (socketId && io) {
      io.to(socketId).emit("new_notification", payload);
    }

    // 🔥 PUSH NOTIFICATION (APP CLOSED)
    let message = "";

    switch (type) {
      case "LIKE_POST":
        message = `${sender.username} liked your post`;
        break;
      case "COMMENT_POST":
        message = `${sender.username} commented on your post`;
        break;
      case "LIKE_COMMENT":
        message = `${sender.username} liked your comment`;
        break;
      case "REPLY_COMMENT":
        message = `${sender.username} replied to your comment`;
        break;
      case "FOLLOW_REQUEST":
        message = `${sender.username} sent you a follow request`;
        break;
      case "FOLLOW_ACCEPTED":
        message = `${sender.username} accepted your follow request`;
        break;
      default:
        message = "You have a new notification";
    }

    await sendPushNotification({
      receiverId,
      title: "DoodlePad",
      body: message,
      data: {
        type,
        postId: postId || "",
        commentId: commentId || ""
      }
    });

    return payload;

  } catch (error) {
    console.error("Notification Error:", error);
    return null;
  }
};