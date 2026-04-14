import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Comment from "../../models/Comment.js";
import { processHashtags } from "../../utils/hashtag.util.js";
import { Op } from "sequelize";

// 🔥 REDIS & BUCKET IMPORT
import redisClient from "../../config/redis.js"; 
import bucket from "../../config/firebase.js"; 

export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, caption, content, isSaved } = req.body;

    const cleanType = type?.trim().toLowerCase();
    const isSavedBool = isSaved === "true" || isSaved === true;
    
    let mediaUrls = [];

    const allowedTypes = ["image", "video", "audio", "doodle", "text"];

    if (!allowedTypes.includes(cleanType)) {
      return res.status(400).json({ message: "Invalid post type" });
    }

    // 🚀 BUCKET UPLOAD LOGIC (Replaced local URL logic)
    if (req.files && req.files.length > 0) {
      // Type ke hisaab se folder select karo
      let folderName = "post_others";
      if (cleanType === "image") folderName = "post_images";
      else if (cleanType === "video") folderName = "post_videos";
      else if (cleanType === "doodle") folderName = "doodles";

      // Sabhi files ko parallel upload karo Bucket mein
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const fileName = `${folderName}/user_${userId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const blob = bucket.file(fileName);
          const stream = blob.createWriteStream({
            metadata: { contentType: file.mimetype },
          });

          stream.on("error", (err) => reject(err));
          stream.on("finish", async () => {
            await blob.makePublic();
            resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
          });

          stream.end(file.buffer);
        });
      });

      mediaUrls = await Promise.all(uploadPromises);
    }

    if (["image", "video", "audio"].includes(cleanType) && mediaUrls.length === 0) {
      return res.status(400).json({ message: "File is required" });
    }

    if (cleanType === "doodle" && !content) {
      return res.status(400).json({ message: "Doodle data required" });
    }

    if (cleanType === "text" && !content) {
      return res.status(400).json({ message: "Content required" });
    }

    let expiresAt = null;

    if (!isSavedBool) {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const post = await Post.create({
      userId,
      type: cleanType,
      content,
      caption,
      mediaUrls,
      isSaved: isSavedBool,
      expiresAt
    });

    // 🚀 CACHE INVALIDATION: Nayi post aate hi purana cache uda do
    if (redisClient?.isReady) {
      await redisClient.del(`userPosts:${userId}`);
    }

    return res.status(201).json({
      success: true,
      message: "Post created",
      post
    });

  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create post"
    });
  }
};

export const getArchivedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `archivedPosts:${userId}`;

    // 🔥 IMPORTANT FIX (Original logic maintained)
    await markExpiredPosts();

    // 🚀 1. Check Redis Cache
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return res.json({ success: true, count: parsedData.length, posts: parsedData });
      }
    }

    // 🚀 2. Fetch from DB if not in Cache
    const posts = await Post.findAll({
      where: { userId, status: "archived" },
      order: [["createdAt", "DESC"]]
    });

    // 🚀 3. Set Cache for 1 Hour
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(posts));
    }

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("ARCHIVE FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch archived posts"
    });
  }
};

export const markExpiredPosts = async () => {
  try {
    await Post.update(
      { status: "archived" },
      {
        where: {
          isSaved: false,
          expiresAt: { [Op.lt]: new Date() },
          status: "active"
        }
      }
    );
  } catch (error) {
    console.error("Expire job error:", error);
  }
};

export const getExpiredPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const posts = await Post.findAll({
      where: {
        userId,
        isSaved: false,
        expiresAt: { [Op.lt]: new Date() }
      },
      order: [["createdAt", "DESC"]]
    });

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("EXPIRED FETCH ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch expired posts"
    });
  }
};

export const restoreArchivedPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post || post.userId !== userId) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.status !== "archived") {
      return res.status(400).json({ success: false, message: "Post is not archived" });
    }

    await post.update({
      status: "active",
      isSaved: true,   // 🔥 now permanent
      expiresAt: null
    });

    // 🚀 CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`userPosts:${userId}`);
      await redisClient.del(`archivedPosts:${userId}`);
    }

    return res.json({ success: true, message: "Post restored and made permanent" });

  } catch (error) {
    console.error("RESTORE ERROR:", error);
    return res.status(500).json({ success: false, message: "Restore failed" });
  }
};

export const archivePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post || post.userId !== userId) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.status === "archived") {
      return res.status(400).json({ success: false, message: "Post already archived" });
    }

    await post.update({
      status: "archived",
      expiresAt: null // 🔥 IMPORTANT (stop expiry)
    });

    // 🚀 CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`userPosts:${userId}`);
      await redisClient.del(`archivedPosts:${userId}`);
    }

    return res.json({ success: true, message: "Post moved to archive" });

  } catch (error) {
    console.error("ARCHIVE ERROR:", error);
    return res.status(500).json({ success: false, message: "Archive failed" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // ✅ Ownership check
    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "You are not allowed to delete this post" });
    }

    // ✅ Already deleted check
    if (post.status === "deleted") {
      return res.status(400).json({ success: false, message: "Post already deleted" });
    }

    await post.update({ status: "deleted" });

    // 🚀 CACHE INVALIDATION
    if (redisClient?.isReady) {
      await redisClient.del(`userPosts:${userId}`);
      await redisClient.del(`archivedPosts:${userId}`);
    }

    return res.json({ success: true, message: "Post deleted successfully" });

  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ success: false, message: "Failed to delete post" });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `userPosts:${id}`;

    // 🚀 1. Check Redis Cache First
    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return res.json({ success: true, count: parsedData.length, posts: parsedData });
      }
    }

    // 🚀 2. Fetch from DB if Cache is empty
    const posts = await Post.findAll({
      where: {
        userId: id,
        status: "active",
        [Op.or]: [
          { isSaved: true },
          {
            isSaved: false,
            expiresAt: { [Op.gt]: new Date() } // ✅ NOT expired
          }
        ]
      },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto"]
        },
        {
          model: Comment,
          as: "comments",
          attributes: ["id", "content", "createdAt"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // 🚀 3. Save to Redis Cache (1 Hour Expiry)
    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(posts));
    }

    return res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error("Get user posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user posts"
    });
  }
};