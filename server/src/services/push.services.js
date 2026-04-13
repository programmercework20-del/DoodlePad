import admin from "../config/firebase.js";
import User from "../models/User.js";

export const sendPushNotification = async ({
  receiverId,
  title,
  body,
  data = {}
}) => {
  try {
    const user = await User.findByPk(receiverId);

    if (!user || !user.fcmToken) return;

    const message = {
      token: user.fcmToken,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK"
      }
    };

    await admin.messaging().send(message);

  } catch (error) {
    console.error("Push Error:", error.message);
  }
};