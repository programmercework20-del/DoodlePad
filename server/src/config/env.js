import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DB_NAME) {
  throw new Error("DB_NAME is not defined in environment variables");
}

export default {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,

  db: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },

  clientUrl: process.env.CLIENT_URL
};
