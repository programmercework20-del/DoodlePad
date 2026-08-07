// import cron from "node-cron";
// import Post from "../models/Post.js";
// import { Op } from "sequelize";

// const archiveExpiredPosts = () => {
//   cron.schedule("*/5 * * * *", async () => {
//     try {
//       console.log("⏳ Checking expired posts...");

//       const expiredPosts = await Post.findAll({
//         where: {
//           expiresAt: { [Op.lte]: new Date() },
//           status: "active",
//           isSaved: false
//         }
//       });

//       for (let post of expiredPosts) {
//         await post.update({ status: "archived" });
//       }

//       console.log(`✅ Archived ${expiredPosts.length} posts`);

//     } catch (error) {
//       console.error("❌ Cron error:", error);
//     }
//   });
// };

// export default archiveExpiredPosts;

import cron from "node-cron";
import Post from "../models/Post.js";
import { Op } from "sequelize";
import redisClient from "../config/redis.js"; // 🔥 FIX: Redis import kiya

const archiveExpiredPosts = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("⏳ Checking expired posts...");

      const expiredPosts = await Post.findAll({
        where: {
          expiresAt: { [Op.lte]: new Date() },
          status: "active",
          isSaved: false
        }
      });

      for (let post of expiredPosts) {
        // 🔥 FIX: expiresAt ko null bhi kiya taaki consistency rahe
        await post.update({ status: "archived", expiresAt: null });

        // 🔥 FIX: Jab post archive ho, toh us user ka cache delete karo
        if (redisClient?.isReady) {
          await redisClient.del(`archivedPosts:${post.userId}`);
          await redisClient.del(`userPosts:${post.userId}`);
        }
      }

      if (expiredPosts.length > 0) {
        console.log(`✅ Archived ${expiredPosts.length} posts and cleared cache`);
      }

    } catch (error) {
      console.error("❌ Cron error:", error);
    }
  });
};

export default archiveExpiredPosts;