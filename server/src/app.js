

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import hpp from "hpp";
import config from "./config/env.js";

// Routes
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

/* =========================
   ROUTES (IMPORTANT PART)
========================= */

// 🔓 APK / MOBILE USER APIs
// signup, login, profile, change-password
app.use("/api", apiRoutes);

// 🔐 ADMIN PANEL APIs (protected)
app.use("/api/admin", adminAuth, adminRoutes);


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
