import dotenv from 'dotenv';
dotenv.config();

export default {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || "development",

    db: {
        name: process.env.DB_NAME || "admin_db",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "12345",
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        dialect: process.env.DB_DIALECT || "postgres"
    },

    jwt: {
        secret: process.env.JWT_SECRET || "your-super-secret-jwt-key",
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    },

    clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
};
