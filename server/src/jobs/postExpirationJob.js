import cron from "node-cron";
import { Op } from "sequelize";
import Post from "../models/Post.js";
import { sendPushNotification } from "../services/push.services.js"; // Tumhari file ka path
import redisClient from "../config/redis.js";

// 🚀 Ye function har 10 minute me automatic chalega (Background me)
export const startPostExpirationCron = () => {
  console.log("⏱️ Post Expiration & Notification Cron Job Started!");

  // "*/10 * * * *" matlab har 10 minute me check karo
  cron.schedule("*/10 * * * *", async () => {
    try {
      const now = new Date();
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

      // ========================================================
      // 1️⃣ THE 12-HOUR WARNING (12 ghante bache hain delete hone me)
      // ========================================================
      const warning12hPosts = await Post.findAll({
        where: {
          isSaved: false, // Unpinned posts only
          status: "active",
          notified12h: false, // Jisko abhi tak message nahi gaya
          expiresAt: {
            [Op.lte]: in12Hours, // Expiry time 12 ghante ya usse kam bacha hai
            [Op.gt]: in1Hour     // Lekin 1 ghante se zyada bacha hai
          }
        },
        attributes: ["id", "userId"]
      });

      for (const post of warning12hPosts) {
        await sendPushNotification({
          receiverId: post.userId,
          title: "DoodlePad",
          body: "Your unpinned post will be deleted in 12 hours. Pin it to save it forever! 📌",
          data: { type: "POST_WARNING", postId: post.id }
        });
        await post.update({ notified12h: true });
        console.log(`📩 Sent 12h warning for post: ${post.id}`);
      }

      // ========================================================
      // 2️⃣ THE 23-HOUR WARNING (Sirf 1 ghanta bacha hai!)
      // ========================================================
      const warning23hPosts = await Post.findAll({
        where: {
          isSaved: false, 
          status: "active",
          notified23h: false, // Jisko final warning nahi gayi
          expiresAt: {
            [Op.lte]: in1Hour, // Expiry me 1 ghanta ya usse kam bacha hai
            [Op.gt]: now       // Par abhi expiry hui nahi hai
          }
        },
        attributes: ["id", "userId"]
      });

      for (const post of warning23hPosts) {
        await sendPushNotification({
          receiverId: post.userId,
          title: "DoodlePad",
          body: "Final reminder! 🚨 Your post will be permanently deleted in 1 hour. Pin it now!",
          data: { type: "POST_WARNING_FINAL", postId: post.id }
        });
        await post.update({ notified23h: true });
        console.log(`📩 Sent 23h FINAL warning for post: ${post.id}`);
      }

      // ========================================================
      // 3️⃣ THE GRIM REAPER (24 Ghante Khatam -> Post Delete)
      // ========================================================
      const expiredPosts = await Post.findAll({
        where: {
          isSaved: false,
          status: "active",
          expiresAt: { [Op.lte]: now } // Time is UP!
        },
        attributes: ["id", "userId"]
      });

      if (expiredPosts.length > 0) {
        for (const post of expiredPosts) {
          // Status ko 'deleted' kar do
          await post.update({ status: "deleted" });

          // 🧹 Cache safai
          if (redisClient?.isReady) {
            await redisClient.del(`userPosts:${post.userId}`);
            await redisClient.del(`post:${post.id}`);
            await redisClient.del(`comments:${post.id}`);
          }
        }
        console.log(`🗑️ Grim Reaper deleted ${expiredPosts.length} expired posts.`);
      }

    } catch (error) {
      console.error("🔥 Error in Post Expiration Cron:", error);
    }
  });
};