import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Comment from "../../models/Comment.js";
import { processHashtags } from "../../utils/hashtag.util.js";
import { Op } from "sequelize";

// 🔥 REDIS & BUCKET IMPORT
import redisClient from "../../config/redis.js"; 
import { bucket } from "../../config/firebase.js";

export const createPost = async (req, res) => {
  try {
    const { type, content, caption, isSaved } = req.body;
    const userId = req.user.id;
    const cleanType = type?.toLowerCase();
    const isSavedBool = isSaved === "true" || isSaved === true;

    console.log(`🚀 Creating Post: Type=${cleanType}, ContentLength=${content?.length || 0}`);

    let mediaUrls = [];


   // 🎨 if DOODLE 
if (cleanType === "doodle") {
  // 🔥 Content = paths JSON hai, base64 nahi
  // File (media) already req.files mein aa rahi hai — wahi use karo
  // Koi alag GCS upload mat karo doodle ke liye
  
  if (req.files && req.files.length > 0) {
    const file = req.files[0]; // doodle JPEG file
    
    const fileName = `post_doodles/doodle_${userId}_${Date.now()}.jpg`;
    const blob = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      const stream = blob.createWriteStream({
        metadata: { contentType: file.mimetype },
        resumable: false,
      });
      stream.on("error", reject);
      stream.on("finish", resolve);
      stream.end(file.buffer);
    });

    mediaUrls.push(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
    console.log("✅ Doodle file uploaded:", fileName);
  }
}

    // 📂 AGAR REGULAR FILES HAIN
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          let folderName = 'post_images';
          if (file.mimetype.startsWith('video')) folderName = 'post_videos';
          else if (file.mimetype.startsWith('audio')) folderName = 'post_audios';

          const fileName = `${folderName}/user_${userId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const blob = bucket.file(fileName);

          blob.save(file.buffer, {
            metadata: { contentType: file.mimetype },
            resumable: file.size > 5 * 1024 * 1024,
          }, (err) => {
            if (err) return reject(err);
            resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
          });
        });
      });
      const uploadedFiles = await Promise.all(uploadPromises);
      mediaUrls = [...mediaUrls, ...uploadedFiles];
    }

    // 🔥 Final Check
    if (["image", "video", "audio", "doodle"].includes(cleanType) && mediaUrls.length === 0) {
       console.error("❌ Validation Failed: No mediaUrls generated");
       return res.status(400).json({ message: "Media file or Doodle data is missing/invalid!" });
    }

    let expiresAt = isSavedBool ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const post = await Post.create({
      userId,
      type: cleanType,
      content: cleanType === "doodle" ? "Doodle Post" : content,
      caption,
      mediaUrls,
      isSaved: isSavedBool,
      expiresAt
    });

    if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);

    return res.status(201).json({ success: true, message: "Post created!", post });

  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ success: false, message: "Failed", error: error.message });
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
    const now = new Date();

    const [updatedRows] = await Post.update(
      {
        status: "archived",
        expiresAt: null   // 🔥 IMPORTANT FIX
      },
      {
        where: {
          isSaved: false,
          status: "active",
          expiresAt: {
            [Op.lte]: now
          }
        }
      }
    );

    console.log(`Archived ${updatedRows} posts`);

  } catch (error) {
    console.error(error);
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