import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import hpp from "hpp";
import config from "./config/env.js";
import path from "path";

const app = express();

/* =========================
   GLOBAL MIDDLEWARES
========================= */
app.set("trust proxy", 1);

app.use(cors({
  origin: ["http://localhost:5173", config.clientUrl].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(helmet());
app.use(hpp());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Too many requests" },
});
app.use("/api", limiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use("/uploads", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(process.cwd(), "uploads")));

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({ success: true, message: "API Server Running", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "OK", time: new Date().toISOString() });
});

/* =========================
   🔥 FAULT-TOLERANT ROUTE LOADER
========================= */
const loadedRoutes = [];
const failedRoutes = [];

const safeLoadRoute = async (routePath, mountPath, routeName) => {
  try {
    const module = await import(routePath);
    const router = module.default;
    if (!router) throw new Error("No default export found");
    app.use(mountPath, router);
    loadedRoutes.push({ name: routeName, path: mountPath });
    console.log(`✅ Route loaded: ${routeName} → ${mountPath}`);
  } catch (err) {
    failedRoutes.push({ name: routeName, path: mountPath, error: err.message });
    console.error(`❌ Route FAILED: ${routeName} → ${err.message}`);

    // 🔥 Failed route ke liye fallback — 503 return karo, app crash nahi hogi
    app.use(mountPath, (req, res) => {
      res.status(503).json({
        success: false,
        message: `${routeName} service is temporarily unavailable`,
        code: "SERVICE_UNAVAILABLE"
      });
    });
  }
};

// 🚀 Saare routes load karo — ek fail hone par baaki chalta rahe
const initRoutes = async () => {
  const routes = [
    // Core routes — sabse important
    ["./routes/api.routes.js", "/api", "API"],
    ["./routes/profile.routes.js", "/api/profile", "Profile"],
    ["./routes/user.routes.js", "/api/users", "Users"],
    ["./routes/post.routes.js", "/api/posts", "Posts"],
    ["./routes/feed.routes.js", "/api/feed", "Feed"],
    ["./routes/message.routes.js", "/api/messages", "Messages"],
    ["./routes/conversation.routes.js", "/api/conversations", "Conversations"],
    
    // Secondary routes
    ["./routes/notification.routes.js", "/api/notifications", "Notifications"],
    ["./routes/search.routes.js", "/api/search", "Search"],
    ["./routes/comment.routes.js", "/api/comments", "Comments"],
    ["./routes/report.routes.js", "/api/reports", "Reports"],
    ["./routes/live.routes.js", "/api/live", "Live"],
    ["./routes/analytics.routes.js", "/api/analytics", "Analytics"],
    ["./routes/blockUnblock.routes.js", "/api/block", "Block"],
    ["./routes/ad.routes.js", "/api/ads", "Ads"],
    ["./routes/hashtag.routes.js", "/api/hashtags", "Hashtags"],
    ["./routes/explore.routes.js", "/api/explore", "Explore"],
    ["./routes/account.routes.js", "/api/account", "Account"],
    ["./routes/closeFriend.routes.js", "/api/close-friends", "CloseFriends"],
    
    // Admin routes
    ["./routes/admin.routes.js", "/api/admin", "Admin"],
    ["./routes/adminMessage.routes.js", "/admin/messages", "AdminMessages"],
  ];

  // Parallel load karo — fast startup
  await Promise.allSettled(
    routes.map(([routePath, mountPath, routeName]) =>
      safeLoadRoute(routePath, mountPath, routeName)
    )
  );

  // Summary print karo
  console.log("\n📊 Route Loading Summary:");
  console.log(`✅ Loaded: ${loadedRoutes.length} routes`);
  if (failedRoutes.length > 0) {
    console.warn(`❌ Failed: ${failedRoutes.length} routes`);
    failedRoutes.forEach(r => console.warn(`   → ${r.name}: ${r.error}`));
  }
  console.log("");
};

// Routes initialize karo
await initRoutes();

/* =========================
   ROUTE STATUS ENDPOINT
========================= */
app.get("/api/route-status", (req, res) => {
  res.json({
    success: true,
    loaded: loadedRoutes,
    failed: failedRoutes,
    total: loadedRoutes.length + failedRoutes.length
  });
});

/* =========================
   ERROR HANDLING
========================= */
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Global error:", err);

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large" });
  }
  if (err.message === "Invalid file type") {
    return res.status(400).json({ success: false, message: "Invalid file type" });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;