import app from './src/app.js';
import { sequelize } from './src/models/index.js';
import config from './src/config/env.js';

const PORT = config.port;

// Database connection and server startup
const startServer = async () => {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log("✅ Database connection established successfully.");

        // Sync database models
        // Using force: false and logging errors instead of crashing
        try {
            if (config.nodeEnv === "development") {
                // Try sync without alter first to be safe, or just sync
                // Note: 'alter: true' can cause issues with some postgres versions/drivers
                await sequelize.sync();
                console.log("✅ Database models synchronized.");
            } else {
                console.log("ℹ️ Production Mode: Skipping auto-sync. Use migrations.");
            }
        } catch (syncError) {
            console.error("⚠️ Database Sync Error (Non-Fatal):", syncError.message);
            console.log("⚠️ Continuing server startup anyway...");
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${config.nodeEnv}`);
            console.log(`📡 API available at http://localhost:${PORT}`);
            console.log(`💊 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error("❌ Unable to start server:", error);
        process.exit(1);
    }
};

startServer();
