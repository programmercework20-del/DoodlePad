import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import hpp from 'hpp';
import config from './config/env.js';

// Import routes
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import reportRoutes from './routes/report.routes.js';
import liveRoutes from './routes/live.routes.js';
import messageRoutes from './routes/message.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

const app = express();

// Middleware - CORS must be first
app.use(
    cors({
        origin: config.clientUrl,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);

// Security Middleware
app.use(helmet()); // Set security headers
app.use(hpp()); // Prevent HTTP Parameter Pollution
app.use(compression()); // Compress response bodies

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs (Increased for Admin Panel)
    message: {
        success: false,
        message: "Too many requests from this IP, please try again later."
    }
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' })); // Body limit is 10kb
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Admin Panel API Server",
        version: "1.0.0"
    });
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Global error handler:", err);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error",
        ...(config.nodeEnv === "development" && { stack: err.stack })
    });
});

export default app;
