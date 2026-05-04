import 'dotenv/config';
import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import cron from "node-cron";
import config from './src/config/env.js';
import http from "http";
import { initSocket } from "./src/socket/socket.js";
import { markExpiredPosts } from "./src/controllers/api/post.controller.js";
import express from 'express'; // 


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
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
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