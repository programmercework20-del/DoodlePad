import cron from "node-cron";
import Post from "../models/Post.js";
import { Op } from "sequelize";

cron.schedule("*/10 * * * *", async () => {
  console.log("⏳ Checking expired posts...");

  try {
    const deleted = await Post.destroy({
      where: {
        isSaved: false,
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    });

    console.log(`🗑️ Deleted ${deleted} expired posts`);
  } catch (error) {
    console.error("Cron error:", error);
  }
});