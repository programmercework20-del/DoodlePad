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

// export const createPost = async (req, res) => {
//   try {
//     const { type,  content, caption, isSaved } = req.body;
//     const userId = req.user.id;
//     const cleanType = type?.toLowerCase();
//     const isSavedBool = isSaved === "true" || isSaved === true;

//     let mediaUrls = [];
//     let thumbnail = null; 

//     if (req.files && req.files.length > 0) {
//       const uploadPromises = req.files.map(async (file, index) => {
//         let folderName = 'post_images';
//         if (cleanType === "doodle" && index === 0) folderName = 'post_doodles';
//         else if (file.mimetype.startsWith('video')) folderName = 'post_videos';
//         else if (file.mimetype.startsWith('audio')) folderName = 'post_audios';

//         const fileName = `${folderName}/user_${userId}_${Date.now()}_${index}`;
//         const blob = bucket.file(fileName);

//         if (file.mimetype.startsWith('video') && !thumbnail) {
//           const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}_${index}.mp4`);
//           const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
          
//           try {
//             fs.writeFileSync(tempVideoPath, file.buffer);

//             await new Promise((resolve, reject) => {
//               ffmpeg(tempVideoPath)
//                 .inputOptions('-threads 2')
//                 .screenshots({
//                   count: 1,
//                   timemarks: ['00:00:01'],
//                   filename: path.basename(tempThumbPath),
//                   folder: os.tmpdir(),
//                   size: '640x?'
//                 })
//                 .on('end', resolve)
//                 .on('error', reject);
//             });

//             const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
//             const thumbBlob = bucket.file(thumbFileName);
//             await thumbBlob.save(fs.readFileSync(tempThumbPath), {
//               metadata: { contentType: 'image/jpeg' }
//             });

//             thumbnail = `https://storage.googleapis.com/${bucket.name}/${thumbFileName}`;

//           } catch (thumbErr) {
//             console.error("⚠️ Thumbnail extraction failed:", thumbErr);
//           } finally {
//             if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
//             if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
//           }
//         }

//         await blob.save(file.buffer, {
//           metadata: { contentType: file.mimetype },
//           resumable: file.size > 5 * 1024 * 1024,
//         });

//         return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//       });

//       mediaUrls = await Promise.all(uploadPromises);
//     }

//     const mediaRequiredTypes = ["image", "video", "audio"];
//     if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0) {
//       return res.status(400).json({ success: false, message: "Media file missing" });
//     }

//     let expiresAt = isSavedBool ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

//     const post = await Post.create({
//       userId,
//       type: cleanType,
//       content: cleanType === "doodle" ? (content || "Doodle Post") : content,
//       caption: caption || "",
//       mediaUrls,
//       thumbnail, 
//       isSaved: isSavedBool,
//       expiresAt
//     });

//     if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
    
//     await processHashtags({
//       caption,
//       postId: post.id
//     });
    
//     return res.status(201).json({ success: true, message: "Post created!", post });

//   } catch (error) {
//     console.error("Create Post Error:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
//   }
// };

export const createPost = async (req, res) => {
  try {
    // 🔥 FIX 1: req.body se duration extract kiya
    const { type, content, caption, isSaved, duration } = req.body;
    const userId = req.user.id;
    const cleanType = type?.toLowerCase();
    const isSavedBool = isSaved === "true" || isSaved === true;

    let mediaUrls = [];
    let thumbnail = null; 

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        let folderName = 'post_images';
        if (cleanType === "doodle" && index === 0) folderName = 'post_doodles';
        else if (file.mimetype.startsWith('video')) folderName = 'post_videos';
        else if (file.mimetype.startsWith('audio')) folderName = 'post_audios';

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
    if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0) {
      return res.status(400).json({ success: false, message: "Media file missing" });
    }

    let expiresAt = isSavedBool ? null : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 🔥 FIX 2: Post database creation ke andar duration add kar diya
    const post = await Post.create({
      userId,
      type: cleanType,
      content: cleanType === "doodle" ? (content || "Doodle Post") : content,
      caption: caption || "",
      mediaUrls,
      thumbnail, 
      isSaved: isSavedBool,
      expiresAt,
      duration: duration ? parseInt(duration, 10) : 0  // Text ko proper number mein convert karega
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
        // 🔥 Inject isLiked
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

    // 🔥 Inject isLiked
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

    // 🔥 Inject isLiked
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

// ============================================================
// 🔥 DELETE OWN OR ADMIN POST (Soft Delete + Full Cache Clear)
// ============================================================
export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id; // Logged-in user ID
    const postId = req.params.id; // URL se mili Post ID

    // 1. Database se post dhoondo
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // 2. 🛡️ Ownership Check: Sirf post ka owner ya Admin hi delete kar sakta hai
    if (post.userId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to delete this post" 
      });
    }

    // 3. Already deleted check
    if (post.status === "deleted") {
      return res.status(400).json({ success: false, message: "Post is already deleted" });
    }

    // 4. Soft Delete Execution (Status 'deleted' mark karo)
    await post.update({ status: "deleted" });

    // 5. 🚀 PRODUCTION CACHE INVALIDATION (Disappear instantly from Everywhere)
    if (redisClient?.isReady) {
      try {
        // User ke profile ki posts ka cache delete karo
        await redisClient.del(`userPosts:${post.userId}`);
        
        // User ke archive posts ka cache delete karo
        await redisClient.del(`archivedPosts:${post.userId}`);
        
        // Individual single post view ka cache clear karo
        await redisClient.del(`post:${postId}`);
        
        // Is post ke comments ka cache bhi clear kardo
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

// export const getUserPosts = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const currentUserId = req.user?.id; 
//     const cacheKey = `userPosts:${id}`;

//     const posts = await Post.findAll({
//       where: {
//         userId: id,
//         status: "active",
//         [Op.or]: [
//           { isSaved: true },
//           {
//             isSaved: false,
//             expiresAt: { [Op.gt]: new Date() } 
//           }
//         ]
//       },
//       attributes: {
//         include: [
//           [
//             Sequelize.literal(`(
//               SELECT COUNT(*)::int
//               FROM "comments" AS c
//               WHERE c."postId" = "Post"."id"
//               AND c."status" = 'active'
//             )`),
//             "commentsCount"
//           ]
//         ]
//       },
//       include: [
//         {
//           model: User,
//           as: "author",
//           attributes: ["id", "username", "profilePhoto"]
//         }
//       ],
//       order: [["createdAt", "DESC"]]
//     });

//     if (redisClient?.isReady && posts.length > 0) {
//       await redisClient.setEx(cacheKey, 300, JSON.stringify(posts)); 
//     }

//     const finalizedPosts = await injectIsLikedFlag(posts, currentUserId);

//     return res.json({
//       success: true,
//       count: finalizedPosts.length,
//       posts: finalizedPosts
//     });

//   } catch (error) {
//     console.error("Get user posts error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch user posts"
//     });
//   }
// };