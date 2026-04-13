import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379"
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisClient.on("connect", () => console.log("✅ Redis connected successfully"));

// Connect to Redis
redisClient.connect().catch(console.error);

export default redisClient;