
// import Notification from "../models/Notification.js";
// import { getIO, getOnlineUsers } from "../socket/socket.js";
// import User from "../models/User.js";
// import { sendPushNotification } from "./push.services.js";

// export const createNotification = async ({
//   senderId,
//   receiverId,
//   type,
//   postId = null,
//   commentId = null,
//   doodleRequestId = null,
//   conversationId = null,
//   messageContent = null,
//   messageType = "text"
// }) => {
//   try {
//     if (senderId === receiverId) return null;

//     let messagePreview = null;
//     if (type === "MESSAGE" && messageContent) {
//       if (messageType === "image") {
//         messagePreview = "📷 Sent a photo";
//       } else if (messageType === "video") {
//         messagePreview = "🎥 Sent a video";
//       } else if (messageType === "audio") {
//         messagePreview = "🎵 Sent an audio message";
//       } else if (messageType === "shared_post") {
//         messagePreview = "🔗 Shared a post";
//       } else {
//         messagePreview = messageContent.length > 100
//           ? messageContent.substring(0, 100) + "..."
//           : messageContent;
//       }
//     }

//     const notification = await Notification.create({
//       senderId,
//       receiverId,
//       type,
//       postId,
//       commentId,
//       doodleRequestId,
//       conversationId,
//       messagePreview,
//       isRead: false
//     });

//     const sender = await User.findByPk(senderId, {
//       attributes: ["id", "username", "profilePhoto"]
//     });

//     const payload = {
//       ...notification.toJSON(),
//       sender
//     };

//     // 🔥 SOCKET (APP OPEN)
//     const io = getIO();
//     const onlineUsers = getOnlineUsers();
//     const socketId = onlineUsers.get(receiverId);

//     if (socketId && io) {
//       io.to(socketId).emit("new_notification", payload);
//     }

//     // 🔥 PUSH NOTIFICATION (APP CLOSED)
//     let message = "";
//     let pushBody = "";

//     switch (type) {
//       case "LIKE_POST":
//         message = `${sender.username} liked your post`;
//         pushBody = message;
//         break;
//       case "COMMENT_POST":
//         message = `${sender.username} commented on your post`;
//         pushBody = message;
//         break;
//       case "LIKE_COMMENT":
//         message = `${sender.username} liked your comment`;
//         pushBody = message;
//         break;
//       case "REPLY_COMMENT":
//         message = `${sender.username} replied to your comment`;
//         pushBody = message;
//         break;
//       case "FOLLOW_REQUEST":
//         message = `${sender.username} sent you a follow request`;
//         pushBody = message;
//         break;
//       case "FOLLOW_ACCEPTED":
//         message = `${sender.username} accepted your follow request`;
//         pushBody = message;
//         break;
//       case "MESSAGE":
//         message = `${sender.username} sent you a message`;
//         pushBody = messagePreview
//           ? `${sender.username}: ${messagePreview}`
//           : message;
//         break;
//       // 🔥 FIX: Doodle notification cases add kiye
//       case "DOODLE_REQUEST":
//         message = `${sender.username} sent you a doodle cover suggestion`;
//         pushBody = message;
//         break;
//       case "DOODLE_ACCEPTED":
//         message = `${sender.username} accepted your doodle cover`;
//         pushBody = message;
//         break;
//       default:
//         message = "You have a new notification";
//         pushBody = message;
//     }

//     await sendPushNotification({
//       receiverId,
//       title: type === "MESSAGE" ? sender.username : "DoodlePad",
//       body: pushBody,
//       data: {
//         type: type,
//         postId: postId || "",
//         commentId: commentId || "",
//         conversationId: conversationId || "",
//         doodleRequestId: doodleRequestId || "", // 🔥 FIX: Add kiya
//         ...(type === "MESSAGE" && {
//           senderId: sender.id || "",
//           senderUsername: sender.username || "",
//           senderAvatar: sender.profilePhoto || "",
//           messagePreview: messagePreview || ""
//         })
//       }
//     });

//     return payload;

//   } catch (error) {
//     console.error("Notification Error:", error);
//     return null;
//   }
// };


import Notification from "../models/Notification.js";
import { getIO, getOnlineUsers } from "../socket/socket.js";
import User from "../models/User.js";
import { sendPushNotification } from "./push.services.js";
import { buildRealtimeNotificationPayload } from "./notificationPayload.js";

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
        messagePreview = messageContent.length > 100
          ? messageContent.substring(0, 100) + "..."
          : messageContent;
      }
    }

    // 1. Create DB Notification Record
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

    // 2. Fetch Sender Details
    const sender = await User.findByPk(senderId, {
      attributes: ["id", "username", "profilePhoto"]
    });

    const senderUsername = sender?.username || "Someone";

    const payload = buildRealtimeNotificationPayload(notification, sender);

    // 3. Socket Emit (App Open Case)
    try {
      const io = getIO();
      const onlineUsers = getOnlineUsers();
      const socketId = onlineUsers?.get(receiverId);

      if (socketId && io) {
        io.to(socketId).emit("new_notification", payload);

        if (["FOLLOW_REQUEST", "DOODLE_REQUEST"].includes(type)) {
          io.to(socketId).emit("new_request", payload);
        }
      }
    } catch (socketErr) {
      console.error("⚠️ Socket Emit Warning:", socketErr.message);
    }

    // 4. Prepare Push Notification Text
    let message = "";
    let pushBody = "";

    switch (type) {
      case "LIKE_POST":
        message = `${senderUsername} liked your post`;
        pushBody = message;
        break;
      case "COMMENT_POST":
        message = `${senderUsername} commented on your post`;
        pushBody = message;
        break;
      case "LIKE_COMMENT":
        message = `${senderUsername} liked your comment`;
        pushBody = message;
        break;
      case "REPLY_COMMENT":
        message = `${senderUsername} replied to your comment`;
        pushBody = message;
        break;
      case "FOLLOW_REQUEST":
        message = `${senderUsername} sent you a follow request`;
        pushBody = message;
        break;
      case "FOLLOW_ACCEPTED":
        message = `${senderUsername} accepted your follow request`;
        pushBody = message;
        break;
      case "MESSAGE":
        message = `${senderUsername} sent you a message`;
        pushBody = messagePreview
          ? `${senderUsername}: ${messagePreview}`
          : message;
        break;
      case "DOODLE_REQUEST":
        message = `${senderUsername} sent you a doodle cover suggestion`;
        pushBody = message;
        break;
      case "DOODLE_ACCEPTED":
        message = `${senderUsername} accepted your doodle cover`;
        pushBody = message;
        break;
      default:
        message = "You have a new notification";
        pushBody = message;
    }

    // 5. 🔥 Push Notification (Non-blocking & Auto Expired Token Cleanup)
    sendPushNotification({
      receiverId,
      title: type === "MESSAGE" ? senderUsername : "DoodlePad",
      body: pushBody,
      data: {
        type: type,
        postId: postId || "",
        commentId: commentId || "",
        conversationId: conversationId || "",
        doodleRequestId: doodleRequestId || "",
        ...(type === "MESSAGE" && {
          senderId: sender?.id || "",
          senderUsername: senderUsername,
          senderAvatar: sender?.profilePhoto || "",
          messagePreview: messagePreview || ""
        })
      }
    }).catch(async (pushErr) => {
      const errString = String(pushErr?.message || pushErr || "");
      console.error("⚠️ Push Notification Warning:", errString);

      // 🔥 FIX: Clean invalid/expired FCM Token from DB
      if (
        errString.includes("NotRegistered") || 
        errString.includes("registration-token-not-registered") ||
        errString.includes("invalid-registration-token")
      ) {
        try {
          await User.update({ fcmToken: null }, { where: { id: receiverId } });
          console.log(`🧹 [FCM CLEANUP] Cleared expired FCM token for user ID: ${receiverId}`);
        } catch (cleanupErr) {
          console.error("⚠️ FCM Token cleanup failed:", cleanupErr.message);
        }
      }
    });

    return payload;

  } catch (error) {
    console.error("🔥 Notification Service Execution Error:", error);
    return null;
  }
};