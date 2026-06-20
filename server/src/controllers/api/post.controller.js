import { Op, Sequelize } from "sequelize";
import Post from "../../models/Post.js";
import User from "../../models/User.js";
import Comment from "../../models/Comment.js";
import { processHashtags } from "../../utils/hashtag.util.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import redisClient from "../../config/redis.js"; 
import { bucket } from "../../config/firebase.js";
import { injectIsLikedFlag } from "../../utils/postHelpers.js";


export const createPost = async (req, res) => {
  try {
    console.log("🕵️‍♂️ [DEBUG] Create Post Frontend Payload:", req.body);

    const { type, content, caption, isSaved, duration, location } = req.body;
    
    console.log("🕵️‍♂️ [DEBUG] Raw Duration received:", duration);
    console.log("🕵️‍♂️ [DEBUG] Raw Location received:", location);

    const userId = req.user.id;
    const cleanType = type?.toLowerCase();
    const isSavedBool = isSaved === "true" || isSaved === true;

    let mediaUrls = [];
    let thumbnail = null; 
    let backgroundAudios = [];

    // Separate handling for backgroundMusic file
    if (req.files && req.files.backgroundMusic && req.files.backgroundMusic.length > 0) {
      const musicFile = req.files.backgroundMusic[0];
      const folderName = 'background_music';
      const fileName = `${folderName}/user_${userId}_${Date.now()}_music`;
      const blob = bucket.file(fileName);
      await blob.save(musicFile.buffer, {
        metadata: { contentType: musicFile.mimetype },
        resumable: musicFile.size > 5 * 1024 * 1024,
      });
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      backgroundAudios = [{
        url: fileUrl,
        duration: duration ? parseFloat(duration) : 0.0
      }];
    } else if (req.body.backgroundMusicUrl || req.body.backgroundAudios) {
      const rawInput = req.body.backgroundMusicUrl || req.body.backgroundAudios;
      if (typeof rawInput === "string") {
        try {
          const parsed = JSON.parse(rawInput);
          if (Array.isArray(parsed)) {
            backgroundAudios = parsed.map(item => ({
              url: item.url || "",
              duration: item.duration !== undefined ? parseFloat(item.duration) : 0.0
            }));
          } else if (typeof parsed === "object" && parsed !== null) {
            backgroundAudios = [{
              url: parsed.url || "",
              duration: parsed.duration !== undefined ? parseFloat(parsed.duration) : 0.0
            }];
          } else {
            backgroundAudios = [{
              url: rawInput,
              duration: duration ? parseFloat(duration) : 0.0
            }];
          }
        } catch (e) {
          backgroundAudios = [{
            url: rawInput,
            duration: duration ? parseFloat(duration) : 0.0
          }];
        }
      } else if (Array.isArray(rawInput)) {
        backgroundAudios = rawInput.map(item => ({
          url: item.url || "",
          duration: item.duration !== undefined ? parseFloat(item.duration) : 0.0
        }));
      } else if (typeof rawInput === "object" && rawInput !== null) {
        backgroundAudios = [{
          url: rawInput.url || "",
          duration: rawInput.duration !== undefined ? parseFloat(rawInput.duration) : 0.0
        }];
      }
    }

    if (req.files && req.files.media && req.files.media.length > 0) {
      const uploadPromises = req.files.media.map(async (file, index) => {
        let folderName = 'post_images'; // default folder

        // 🔥 UPDATE: Mimetype based priority so audio files always go to 'post_audios'
        if (file.mimetype.startsWith('video')) {
          folderName = 'post_videos';
        } else if (file.mimetype.startsWith('audio')) {
          folderName = 'post_audios';
        } else if (cleanType === "doodle") {
          folderName = 'post_doodles';
        }

        const fileName = `${folderName}/user_${userId}_${Date.now()}_${index}`;
        const blob = bucket.file(fileName);

        if (file.mimetype.startsWith('video') && !thumbnail) {
          const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}_${index}.mp4`);
          const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
          
          try {
            fs.writeFileSync(tempVideoPath, file.buffer);

            await new Promise((resolve, reject) => {
              ffmpeg(tempVideoPath)
                .inputOptions('-threads 2')
                .screenshots({
                  count: 1,
                  timemarks: ['00:00:01'],
                  filename: path.basename(tempThumbPath),
                  folder: os.tmpdir(),
                  size: '640x?'
                })
                .on('end', resolve)
                .on('error', reject);
            });

            const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
            const thumbBlob = bucket.file(thumbFileName);
            await thumbBlob.save(fs.readFileSync(tempThumbPath), {
              metadata: { contentType: 'image/jpeg' }
            });

            thumbnail = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;

          } catch (thumbErr) {
            console.error("⚠️ Thumbnail extraction failed:", thumbErr);
          } finally {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
          }
        }

        await blob.save(file.buffer, {
          metadata: { contentType: file.mimetype },
          resumable: file.size > 5 * 1024 * 1024,
        });

        return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      });

      mediaUrls = await Promise.all(uploadPromises);
    }

    const mediaRequiredTypes = ["image", "video", "audio"];
    if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0 && (!backgroundAudios || backgroundAudios.length === 0)) {
      return res.status(400).json({ success: false, message: "Media file missing" });
    }

    let expiresAt = isSavedBool ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const post = await Post.create({
      userId,
      type: cleanType,
      content: cleanType === "doodle" ? (content || "Doodle Post") : content,
      caption: caption || "",
      mediaUrls, 
      thumbnail, 
      location: location || null,
      isSaved: isSavedBool,
      expiresAt,
      duration: duration ? parseInt(duration, 10) : 0,  
      backgroundAudios,
    });

    if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
    
    await processHashtags({
      caption,
      postId: post.id
    });
    
    return res.status(201).json({ success: true, message: "Post created!", post });

  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

export const getArchivedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `archivedPosts:${userId}`;

    await markExpiredPosts();

    if (redisClient?.isReady) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const finalizedPosts = await injectIsLikedFlag(parsedData, userId);
        return res.json({ success: true, count: finalizedPosts.length, posts: finalizedPosts });
      }
    }

    const posts = await Post.findAll({
      where: { userId, status: "archived" },
      order: [["createdAt", "DESC"]]
    });

    if (redisClient?.isReady) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(posts));
    }

    const finalizedPosts = await injectIsLikedFlag(posts, userId);

    return res.json({
      success: true,
      count: finalizedPosts.length,
      posts: finalizedPosts
    });

  } catch (error) {
    console.error("ARCHIVE FETCH ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch archived posts" });
  }
};

export const markExpiredPosts = async () => {
  try {
    const now = new Date();
    const [updatedRows] = await Post.update(
      { status: "archived", expiresAt: null },
      { where: { isSaved: false, status: "active", expiresAt: { [Op.lte]: now } } }
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

    const finalizedPosts = await injectIsLikedFlag(posts, userId);

    return res.json({
      success: true,
      count: finalizedPosts.length,
      posts: finalizedPosts
    });

  } catch (error) {
    console.error("EXPIRED FETCH ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch expired posts" });
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

    await post.update({ status: "active", isSaved: true, expiresAt: null });

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

    await post.update({ status: "archived", expiresAt: null });

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

    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to delete this post" 
      });
    }

    if (post.status === "deleted") {
      return res.status(400).json({ success: false, message: "Post is already deleted" });
    }

    await post.update({ status: "deleted" });

    if (redisClient?.isReady) {
      try {
        await redisClient.del(`userPosts:${post.userId}`);
        await redisClient.del(`archivedPosts:${post.userId}`);
        await redisClient.del(`post:${postId}`);
        await redisClient.del(`comments:${postId}`);
        
        console.log(`🧹 All Redis caches wiped out for deleted postId: ${postId}`);
      } catch (cacheErr) {
        console.error("⚠️ Redis Cache clear failed during deletion:", cacheErr.message);
      }
    }

    return res.json({ 
      success: true, 
      message: "Post deleted successfully" 
    });

  } catch (error) {
    console.error("🔥 DELETE POST ERROR:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal Server Error during post deletion" 
    });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id; 
    const cacheKey = `userPosts:${id}`;

    const posts = await Post.findAll({
      where: {
        userId: id,
        status: "active",
        [Op.or]: [
          { isSaved: true },
          {
            isSaved: false,
            expiresAt: { [Op.gt]: new Date() } 
          }
        ]
      },
      attributes: {
        include: [
          [
           Sequelize.literal(`(
  SELECT COUNT(*)::int
  FROM "comments" AS c
  WHERE c."postId" = "Post"."id" 
  AND c."status" = 'active'
)`),
            "commentsCount"
          ]
        ]
      },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "profilePhoto"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    if (redisClient?.isReady && posts.length > 0) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(posts)); 
    }

    const finalizedPosts = await injectIsLikedFlag(posts, currentUserId);

    return res.json({
      success: true,
      count: finalizedPosts.length,
      posts: finalizedPosts
    });

  } catch (error) {
    console.error("Get user posts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user posts"
    });
  }
};