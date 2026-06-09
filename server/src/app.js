import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import hpp from "hpp";  
import config from "./config/env.js";
import cron from "node-cron";

// Routes
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import postRoutes from "./routes/post.routes.js";
import reportRoutes from "./routes/report.routes.js";
import liveRoutes from "./routes/live.routes.js";
import adminMessageRoutes from "./routes/adminMessage.routes.js"
import analyticsRoutes from "./routes/analytics.routes.js";
import searchRoutes from "./routes/search.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import conversationRoutes from './routes/conversation.routes.js';
import profileRoutes from './routes/profile.routes.js';
import adRoutes from "./routes/ad.routes.js"; 
import blockUnblockRoutes from "./routes/blockUnblock.routes.js";
import hashtagRoutes from "./routes/hashtag.routes.js";
import exploreRoutes from "./routes/explore.routes.js";
import "./jobs/cron.js"; // ✅ ADD THIS LINE
import archiveExpiredPosts from "./jobs/archivePosts.js";
import errorMiddleware from "./middlewares/error.middleware.js";

import path from "path";
// import adRoutes from "./routes/ad.routes.js";

import apiRoutes from "./routes/api.routes.js";          // ✅ APK routes
import adminRoutes from "./routes/admin.routes.js";      // ✅ Admin panel

// Middlewares  
import adminAuth from "./middlewares/adminAuth.js";



const app = express();

/* =========================
   GLOBAL MIDDLEWARES
========================= */

// CORS
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Security
app.use(helmet());
app.use(hpp());
app.use(compression());

// Rate limit (API only)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: {
    success: false,
    message: "Too many requests, try again later",
  },
});
app.use("/api", limiter);

// Body parsers
// Apne server.js/app.js me isko update karein:
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.set("trust proxy", 1);

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Server Running",
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    time: new Date().toISOString(),
  });
});

app.use(
  "/uploads",
  (req, res, next) => {
    res.header(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.header(
      "Cross-Origin-Resource-Policy",
      "cross-origin"
    );

    next();
  },
  express.static(
    path.join(process.cwd(), "uploads")
  )
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ API routes
app.use("/api/profile", profileRoutes);

// test route delete after testing
// 🧪 TEST ROUTE: Safety net check karne ke liye (Testing ke baad hata dena)
app.get("/api/test-crash", (req, res, next) => {
  // Hum jaan-boojh kar ek achanak aane wala error paida kar rahe hain
  throw new Error("Boom! 💥 Yeh ek test explosion hai!");
});

// 🧪 TEST ROUTE 2: Background Promise fail check karne ke liye
app.get("/api/test-promise", (req, res) => {
  // Yeh background mein achanak fail hoga
  Promise.reject(new Error("Background task phat gaya!"));
  res.json({ success: true, message: "Request accept ho gayi, par background error aayega." });
});

app.use("/api/users", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/block", blockUnblockRoutes);
app.use("/api/hashtags", hashtagRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api", apiRoutes);
// app.use(express.static("public"));



// 404 handler
/* =========================
   ROUTES (IMPORTANT PART)
========================= */

  // // 🔓 APK / MOBILE USER APIs
  // // signup, login, profile, change-password
  // app.use("/api", apiRoutes);
// 🔓 APK / MOBILE USER APIs
// signup, login, profile, change-password


// 🔐 ADMIN PANEL APIs (protected)
app.use("/api/admin", adminRoutes);

app.use("/admin/comments", commentRoutes);

app.use("/admin/messages", adminMessageRoutes);

app.use("/api/ads", adRoutes);


// app.use("/api/admin/ads", adRoutes);

/* =========================
   ERROR HANDLING
========================= */
/* =========================
   ROUTES (IMPORTANT PART)
========================= */

// 🔓 APK / MOBILE USER APIs
// signup, login, profile, change-password

  // // 🔐 ADMIN PANEL APIs (protected)
  // app.use("/api/admin", adminAuth, adminRoutes);



  
archiveExpiredPosts();


/* =========================
   ERROR HANDLING
========================= */

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Aapka existing error middleware
app.use(errorMiddleware);

// ==========================================
// 🛡️ SAFETY NET 1: ULTIMATE GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("🔥 [GLOBAL ERROR CAUGHT BY SAFETY NET]:", err.message);
  
  // Agar response pehle hi bheja ja chuka hai, toh Express ko aage badhne do (crash prevent karne ke liye)
  if (res.headersSent) {
    return next(err);
  }

  // App ko zinda rakhte hue clean error response bhejo
  res.status(500).json({
    success: false,
    message: "Something went wrong in this module, but the app is still running!"
  });
});

export default app;