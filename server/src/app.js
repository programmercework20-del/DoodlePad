import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import hpp from "hpp";  
import config from "./config/env.js";
import cron from "node-cron";


import userRoutes from "./routes/user.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import postRoutes from "./routes/post.routes.js";
import reportRoutes from "./routes/report.routes.js";
import liveRoutes from "./routes/live.routes.js";
import messageRoutes from "./routes/message.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import searchRoutes from "./routes/search.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import profileRoutes from "./routes/profile.routes.js";


import "./jobs/cron.js"; // ✅ ADD THIS LINE
import archiveExpiredPosts from "./jobs/archivePosts.js";

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
app.set('trust proxy', 1); // 🔥 Nginx/reverse proxy ke liye
// Security
app.use(helmet());
app.use(hpp());
app.use(compression());

// Rate limit (API only)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    message: "Too many requests, try again later",
  },
});
app.use("/api", limiter);

// Body parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

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


//static serve 
app.use("/uploads", express.static("uploads"));


// ✅ API routes
-// ... middle of app.js
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(express.static("public"));
app.use("/api/admin", adminRoutes);



// 404 handler
/* =========================
   ROUTES (IMPORTANT PART)
========================= */

  // // 🔓 APK / MOBILE USER APIs
  // // signup, login, profile, change-password
  // app.use("/api", apiRoutes);
// 🔓 APK / MOBILE USER APIs
// signup, login, profile, change-password
app.use("/api", apiRoutes);

// 🔐 ADMIN PANEL APIs (protected)
app.use("/api/admin", adminAuth, adminRoutes);

app.use("/admin/comments", commentRoutes);


// app.use("/api/admin/ads", adRoutes);

/* =========================
   ERROR HANDLING
========================= */

// 404

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found"
    });
}); 
/* =========================
   ROUTES (IMPORTANT PART)
========================= */

// 🔓 APK / MOBILE USER APIs
// signup, login, profile, change-password
app.use("/api", apiRoutes);
app.use("/uploads", express.static("uploads"));

  // // 🔐 ADMIN PANEL APIs (protected)
  // app.use("/api/admin", adminAuth, adminRoutes);



  
archiveExpiredPosts();
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


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

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(config.nodeEnv === "development" && { stack: err.stack }),
  });
});


export default app;
