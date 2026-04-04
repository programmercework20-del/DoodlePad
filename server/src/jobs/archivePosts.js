import cron from "node-cron";
import Post from "../models/Post.js";
import { Op } from "sequelize";

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
        await post.update({ status: "archived" });
      }

      console.log(`✅ Archived ${expiredPosts.length} posts`);

    } catch (error) {
      console.error("❌ Cron error:", error);
    }
  });
};

export default archiveExpiredPosts;