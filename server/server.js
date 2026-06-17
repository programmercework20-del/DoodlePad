// 🔥 Process handlers SABSE PEHLE — import se bhi pehle
process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED REJECTION:", reason);
  // App crash nahi hogi
});

process.on("uncaughtException", (error) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", error);
  // App crash nahi hogi
});

import 'dotenv/config';
import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import cron from "node-cron";
import config from './src/config/env.js';
import http from "http";
import { initSocket } from "./src/socket/socket.js";
import { markExpiredPosts } from "./src/controllers/api/post.controller.js";
import Ad from './src/models/Ad.js';
import { Op } from 'sequelize';

const PORT = config.port || 5000;

// 🔥 CRON JOB — har ghante expired posts archive karo
cron.schedule("0 * * * *", async () => {
  try {
    console.log("⏳ Checking expired posts (every 1 hour)...");
    await markExpiredPosts();

    await Ad.update(
      { status: "expired" },
      {
        where: {
          endDate: { [Op.lt]: new Date() },
          status: "active"
        }
      }
    );
  } catch (err) {
    console.error("Cron Job Error:", err.message);
  }
});

const server = http.createServer(app);

// ✅ Socket.IO initialize
initSocket(server);

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    if (config.nodeEnv === "development") {
      await sequelize.sync({ alter: true });
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
    });

  } catch (error) {
    console.error("❌ Server Start Error:", error);
    process.exit(1);
  }
};

startServer();

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM RECEIVED — Graceful shutdown...");
  try {
    await sequelize.close();
    server.close(() => {
      console.log("✅ Server closed gracefully");
      process.exit(0);
    });
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
});