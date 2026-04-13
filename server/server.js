import 'dotenv/config';
import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import cron from "node-cron";
import config from './src/config/env.js';
import http from "http";
import { initSocket } from "./src/socket/socket.js";

const PORT = config.port;
// 🔥 हर 1 घंटे में run होगा
cron.schedule("0 * * * *", async () => {
  console.log("⏳ Checking expired posts (every 1 hour)...");
  await markExpiredPosts();
});

const server = http.createServer(app);

// ✅ Initialize Socket.IO (ONLY HERE)
initSocket(server);

// START SERVER
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    if (config.nodeEnv === "development") {
      await sequelize.sync({alter: true});
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on ${PORT}`);
    });

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();