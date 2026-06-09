process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 UNHANDLED REJECTION");
  console.error("Reason:", reason);
  // DON'T crash app
});

process.on("uncaughtException", (error) => {
  console.error("🔥 UNCAUGHT EXCEPTION");
  console.error(error);
  // optional graceful shutdown
});

import 'dotenv/config';
import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import cron from "node-cron";
import config from './src/config/env.js';
import http from "http";
import { initSocket } from "./src/socket/socket.js";
import { markExpiredPosts } from "./src/controllers/api/post.controller.js";
import express from 'express'; 
import Ad from './src/models/Ad.js';
import { Op } from 'sequelize'; 

const PORT = config.port || 5000;

// 🔥 1. TRUST PROXY: GCP/Cloud deployment ke liye mandatory hai
app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CRON JOB
cron.schedule("* * * * *", async () => {
  try {
    console.log("⏳ Checking expired posts (every 1 hour)...");
    await markExpiredPosts();

    // 🔥 FIX: Brackets ko Sequelize format ke hisaab se theek kar diya hai
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
    console.error("Cron Job Error:", err);
  }
});

// ==========================================
// 🛡️ SAFETY NET 1: GLOBAL ERROR HANDLER
// ==========================================
// Agar kisi bhi route ya module mein error aayega, toh server yahan catch kar lega aur 502 nahi dega!
app.use((err, req, res, next) => {
  console.error("🔥 [GLOBAL ERROR CAUGHT]:", err.message);
  
  res.status(500).json({
    success: false,
    message: "Something went wrong in this module, but the app is still running!"
  });
});

const server = http.createServer(app);

// ✅ Initialize Socket.IO
initSocket(server);

// START SERVER
const startServer = async () => {
  try {
    // DB Connection check
    await sequelize.authenticate();
    console.log("✅ DB connected");

    // Only sync in dev mode
    if (config.nodeEnv === "development") {
      console.log("🔄 Syncing Database...");
      await sequelize.sync({ alter: true });
    }

    // 🔥 2. BIND TO 0.0.0.0: Isse bahar ke connections (Android/iOS) allow hote hain
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

process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM RECEIVED");
  await sequelize.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});