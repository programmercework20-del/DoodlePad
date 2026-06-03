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
  doodleRequestId = null,
  conversationId = null,
  messageContent = null,
  messageType = "text"
}) => {
  try {
    if (senderId === receiverId) return null;

    // Generate message preview based on content and type
    let messagePreview = null;
    if (type === "MESSAGE" && messageContent) {
      if (messageType === "image") {
        messagePreview = "📷 Sent a photo";
      } else if (messageType === "video") {
        messagePreview = "🎥 Sent a video";
      } else if (messageType === "audio") {
        messagePreview = "🎵 Sent an audio message";
      } else if (messageType === "shared_post") {
        messagePreview = "🔗 Shared a post";
      } else {
        // Limit text preview to 100 characters
        messagePreview = messageContent.length > 100
          ? messageContent.substring(0, 100) + "..."
          : messageContent;
      }
    }

    const notification = await Notification.create({
      senderId,
      receiverId,
      type,
      postId,
      commentId,
      doodleRequestId,
      conversationId,
      messagePreview,
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
    let pushBody = "";

    switch (type) {
      case "LIKE_POST":
        message = `${sender.username} liked your post`;
        pushBody = message;
        break;
      case "COMMENT_POST":
        message = `${sender.username} commented on your post`;
        pushBody = message;
        break;
      case "LIKE_COMMENT":
        message = `${sender.username} liked your comment`;
        pushBody = message;
        break;
      case "REPLY_COMMENT":
        message = `${sender.username} replied to your comment`;
        pushBody = message;
        break;
      case "FOLLOW_REQUEST":
        message = `${sender.username} sent you a follow request`;
        pushBody = message;
        break;
      case "FOLLOW_ACCEPTED":
        message = `${sender.username} accepted your follow request`;
        pushBody = message;
        break;

      case "MESSAGE":
        message = `${sender.username} sent you a message`;
        pushBody = messagePreview ? `${sender.username}: ${messagePreview}` : message;
        break;
      default:
        message = "You have a new notification";
        pushBody = message;
    }

    await sendPushNotification({
      receiverId,
      title: type === "MESSAGE" ? sender.username : "DoodlePad",
      body: pushBody,
      data: {
        type: type,
        postId: postId || "",
        commentId: commentId || "",
        conversationId: conversationId || "",
        // 🔥 FLATTENED FCM PAYLOAD (No nested objects)
        ...(type === "MESSAGE" && {
          senderId: sender.id || "",
          senderUsername: sender.username || "",
          senderAvatar: sender.profilePhoto || "",
          messagePreview: messagePreview || ""
        })
      }
    });

    return payload;

  } catch (error) {
    console.error("Notification Error:", error);
    return null;
  }
};