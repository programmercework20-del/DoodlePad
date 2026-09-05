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
import { getVideoDuration } from "../../utils/getVideoDuration.js";
import Follower from "../../models/Follower.js";
import sharp from "sharp"; // 🔥 PRO-LEVEL: For generating WebP from Doodle SVGs



// 🚨 YAHAN HLS CONVERTER IMPORT KIYA HAI
import { startHlsConversion } from "../../services/transcoder.service.js";


// 🔥 PRO-LEVEL CDN BASE URL (From GCP Load Balancer)
const CDN_BASE_URL = "http://34.160.65.14";

// ==========================================
// 🎨 HELPER: Convert SVG Paths to WebP Image
// ==========================================
async function generateDoodleImage(pathsArray) {
  if (!pathsArray || !Array.isArray(pathsArray) || pathsArray.length === 0) return null;

  let svgString = `<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">`;
  
  pathsArray.forEach(p => {
    const d = p.path || p.d || '';
    const color = p.color || '#1C1C1E';
    const strokeWidth = p.strokeWidth || p.size || 5;
    if(d) {
      svgString += `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    }
  });
  
  svgString += `</svg>`;

  return await sharp(Buffer.from(svgString))
    .webp({ quality: 80, lossless: false }) // WebP is super light
    .toBuffer();
}
// before trim
// export const createPost = async (req, res) => {
//   try {
//     console.log("🕵️‍♂️ [DEBUG] Create Post Frontend Payload:", req.body);

//     const { type, content, caption, isSaved, duration, location } = req.body;
    
//     console.log("🕵️‍♂️ [DEBUG] Raw Video Duration received:", duration);
//     console.log("🕵️‍♂️ [DEBUG] Raw Location received:", location);

//     const userId = req.user.id;
//     const cleanType = type?.toLowerCase();
//     const isSavedBool = isSaved === "true" || isSaved === true;

//     let mediaUrls = [];
//     let thumbnail = null; 
//     let backgroundAudios = [];
//     let parsedDoodlePaths = [];
    
//     // Naya variable uploaded file name store karne ke liye
//     let uploadedVideoFileName = null;

//     // ==========================================
//     // 🎨 0. DOODLE RASTERIZATION (Convert to WebP)
//     // ==========================================
//     if (cleanType === "doodle" && content) {
//       try {
//         parsedDoodlePaths = typeof content === "string" ? JSON.parse(content) : content;
        
//         if (Array.isArray(parsedDoodlePaths) && parsedDoodlePaths.length > 0) {
//           const imageBuffer = await generateDoodleImage(parsedDoodlePaths);
          
//           if (imageBuffer) {
//             const fileName = `post_doodles_rendered/doodle_${userId}_${Date.now()}.webp`;
//             const blob = bucket.file(fileName);
            
//             await blob.save(imageBuffer, {
//               metadata: { contentType: 'image/webp' },
//             });

//             // Set the generated image as both thumbnail and mediaUrl via CDN
//             const doodleImageUrl = `${CDN_BASE_URL}/${fileName}`;
//             thumbnail = doodleImageUrl; 
//             mediaUrls.push(doodleImageUrl); 
//             console.log("✅ Doodle Successfully Rendered to WebP:", doodleImageUrl);
//           }
//         }
//       } catch (e) {
//         console.error("⚠️ Doodle paths parse or render error:", e);
//       }
//     }

//     // ==========================================
//     // 1. BACKGROUND MUSIC HANDLING (With Fast-Start)
//     // ==========================================
//     if (req.files && req.files.backgroundMusic && req.files.backgroundMusic.length > 0) {
//       const musicFile = req.files.backgroundMusic[0];
      
//       let calculatedAudioDuration = 0;
//       const tempAudioPath = path.join(os.tmpdir(), `temp_bgm_${Date.now()}.mp4`);
//       const processedAudioPath = path.join(os.tmpdir(), `processed_bgm_${Date.now()}.mp4`); // 🔥 Fast-Start path
//       let uploadBuffer = musicFile.buffer; // Default fallback buffer
      
//       try {
//         fs.writeFileSync(tempAudioPath, musicFile.buffer);
//         calculatedAudioDuration = await getVideoDuration(tempAudioPath);

//         // 🔥 FAST-START MAGIC: Moving moov atom to the front for instant play
//         await new Promise((resolve, reject) => {
//           ffmpeg(tempAudioPath)
//             .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
//             .save(processedAudioPath)
//             .on('end', resolve)
//             .on('error', reject);
//         });

//         // Use the newly processed fast-start buffer
//         uploadBuffer = fs.readFileSync(processedAudioPath);

//       } catch (e) {
//         console.error("⚠️ Backend Audio Fast-Start/Calc Error:", e.message);
//       } finally {
//         if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
//         if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
//       }

//       const folderName = 'background_music';
//       const fileName = `${folderName}/user_${userId}_${Date.now()}_music`;
//       const blob = bucket.file(fileName);
      
//       await blob.save(uploadBuffer, { // 🔥 Uploading processed buffer
//         metadata: { contentType: musicFile.mimetype },
//         resumable: uploadBuffer.length > 5 * 1024 * 1024,
//       });
      
//       const fileUrl = `${CDN_BASE_URL}/${fileName}`;
//       backgroundAudios = [{
//         url: fileUrl,
//         duration: parseFloat(parseFloat(calculatedAudioDuration).toFixed(2)) 
//       }];
      
//     } else if (req.body.backgroundMusicUrl || req.body.backgroundAudios) {
//       const rawInput = req.body.backgroundMusicUrl || req.body.backgroundAudios;
//       const fallbackDuration = req.body.audioDuration || req.body.backgroundMusicDuration || duration || 0;
      
//       try {
//         if (typeof rawInput === "string") {
//           const parsed = JSON.parse(rawInput);
//           if (Array.isArray(parsed)) {
//             backgroundAudios = parsed.map(item => ({
//               url: item.url || "",
//               duration: item.duration !== undefined ? parseFloat(item.duration) : parseFloat(fallbackDuration)
//             }));
//           } else if (typeof parsed === "object" && parsed !== null) {
//             backgroundAudios = [{
//               url: parsed.url || "",
//               duration: parsed.duration !== undefined ? parseFloat(parsed.duration) : parseFloat(fallbackDuration)
//             }];
//           } else {
//             backgroundAudios = [{ url: rawInput, duration: parseFloat(fallbackDuration) }];
//           }
//         } else if (Array.isArray(rawInput)) {
//           backgroundAudios = rawInput.map(item => ({
//             url: item.url || "",
//             duration: item.duration !== undefined ? parseFloat(item.duration) : parseFloat(fallbackDuration)
//           }));
//         } else if (typeof rawInput === "object" && rawInput !== null) {
//           backgroundAudios = [{
//             url: rawInput.url || "",
//             duration: rawInput.duration !== undefined ? parseFloat(rawInput.duration) : parseFloat(fallbackDuration)
//           }];
//         }
//       } catch (e) {
//         backgroundAudios = [{ url: rawInput, duration: parseFloat(fallbackDuration) }];
//       }
//     }

//     // ==========================================
//     // 2. MAIN MEDIA UPLOAD HANDLING (With Fast-Start for Audio)
//     // ==========================================
//     if (req.files && req.files.media && req.files.media.length > 0) {
//       const uploadPromises = req.files.media.map(async (file, index) => {
//         let folderName = 'post_images'; 

//         if (file.mimetype.startsWith('video')) folderName = 'post_videos';
//         else if (file.mimetype.startsWith('audio')) folderName = 'post_audios';

//         const rawFileNameWithoutPath = `user_${userId}_${Date.now()}_${index}`;
//         const fileName = `${folderName}/${rawFileNameWithoutPath}`;
        
//         // 🚨 Video ke case me humein fileName save karna hai Transcoder ke liye
//         if (file.mimetype.startsWith('video')) {
//             uploadedVideoFileName = fileName; 
//         }
        
//         const blob = bucket.file(fileName);

//         let calculatedMediaAudioDuration = 0;
//         let uploadBuffer = file.buffer; // Default raw buffer fallback

//         // 🔥 Audio handling with Fast-Start
//         if (file.mimetype.startsWith('audio')) {
//           const tempAudioPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}_${index}.mp4`);
//           const processedAudioPath = path.join(os.tmpdir(), `processed_audio_${Date.now()}_${index}.mp4`);
//           try {
//             fs.writeFileSync(tempAudioPath, file.buffer);
//             calculatedMediaAudioDuration = await getVideoDuration(tempAudioPath);

//             // Fast-Start conversion
//             await new Promise((resolve, reject) => {
//               ffmpeg(tempAudioPath)
//                 .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
//                 .save(processedAudioPath)
//                 .on('end', resolve)
//                 .on('error', reject);
//             });

//             uploadBuffer = fs.readFileSync(processedAudioPath); // Use fast-start buffer
//             console.log("✅ [SUCCESS] FFmpeg Fast-Start applied to Audio!");
//           } catch (e) {
//             console.error("⚠️ Backend Audio Fast-Start/Calc Error:", e.message);
//           } finally {
//             if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
//             if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
//           }
//         }

//         // Thumbnail extraction for videos
//         if (file.mimetype.startsWith('video') && !thumbnail) {
//           const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}_${index}.mp4`);
//           const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
          
//           try {
//             fs.writeFileSync(tempVideoPath, file.buffer);

//             await new Promise((resolve, reject) => {
//               ffmpeg(tempVideoPath)
//                 .inputOptions('-threads 2')
//                 .screenshots({
//                   count: 1, timemarks: ['00:00:01'], filename: path.basename(tempThumbPath),
//                   folder: os.tmpdir(), size: '640x?'
//                 })
//                 .on('end', resolve).on('error', reject);
//             });

//             const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
//             const thumbBlob = bucket.file(thumbFileName);
//             await thumbBlob.save(fs.readFileSync(tempThumbPath), {
//               metadata: { contentType: 'image/jpeg' }
//             });

//             thumbnail = `${CDN_BASE_URL}/${thumbFileName}`;

//           } catch (thumbErr) {
//             console.error("⚠️ Thumbnail extraction failed:", thumbErr);
//           } finally {
//             if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
//             if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
//           }
//         }

//         // Final Upload to GCP (Uses processed buffer for audio, raw for images/video)
//         await blob.save(uploadBuffer, {
//           metadata: { contentType: file.mimetype },
//           resumable: uploadBuffer.length > 5 * 1024 * 1024,
//         });

//         const fileUrl = `${CDN_BASE_URL}/${fileName}`;

//         if (file.mimetype.startsWith('audio')) {
//           backgroundAudios.push({
//             url: fileUrl,
//             duration: parseFloat(parseFloat(calculatedMediaAudioDuration).toFixed(2))
//           });
//           return null; 
//         }

//         return fileUrl;
//       });

//       const results = await Promise.all(uploadPromises);
//       const filteredResults = results.filter(url => url !== null);
//       mediaUrls = [...mediaUrls, ...filteredResults]; // Merge with possible doodle image
//     }

//     // ==========================================
//     // 3. VALIDATION & DATABASE SAVE
//     // ==========================================
//     const mediaRequiredTypes = ["image", "video", "audio"];
//     if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0 && (!backgroundAudios || backgroundAudios.length === 0)) {
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
//       location: location || null,
//       isSaved: isSavedBool,
//       expiresAt,
//       duration: duration ? parseInt(duration, 10) : 0,  
//       backgroundAudios, 
//     });
    
//     // ==========================================
//     // 🚨 3.5. HLS CONVERSION LOGIC (NEW)
//     // ==========================================
//     // if (cleanType === 'video' && uploadedVideoFileName) {
//     //     // HLS conversion background me chalega bina app ko roke
//     //     startHlsConversion(uploadedVideoFileName, post.id)
//     //         .then(async (hlsUrl) => {
//     //             if (hlsUrl) {
//     //                 await post.update({ mediaUrls: [hlsUrl] }); // Replace MP4 link with M3U8 link
//     //                 console.log(`✅ Post ${post.id} updated with HLS URL:`, hlsUrl);
                    
//     //                 // Clear cache again since URL updated
//     //                 if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
//     //             }
//     //         })
//     //         .catch(err => console.error("⚠️ HLS Background Error:", err));
//     // }

// if (cleanType === 'video' && uploadedVideoFileName) {
        
//         const attemptHlsWithRetry = async (retries = 3) => {
//             for (let i = 1; i <= retries; i++) {
//                 try {
//                     const hlsUrl = await startHlsConversion(uploadedVideoFileName, post.id);
//                     if (hlsUrl) {
//                         await post.update({ mediaUrls: [hlsUrl] });
//                         console.log(`✅ [HLS SUCCESS] Post ${post.id} updated!`);
//                         if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
//                         return; // 🎯 Success ho gaya, loop se bahar aa jao
//                     }
//                 } catch (err) {
//                     console.error(`⚠️ [HLS ATTEMPT ${i} FAILED]:`, err.message);
//                     if (i === retries) {
//                         // 🚨 Teeno attempt fail ho gaye
//                         console.error(`❌ [CRITICAL] HLS permanently failed for Post ${post.id}`);
//                         // Future me yahan Discord/Slack ya Email par alert bhejne ka code daal sakte ho
//                     } else {
//                         // Agle try se pehle 5 seconds wait karo
//                         await new Promise(res => setTimeout(res, 5000));
//                     }
//                 }
//             }
//         };

//         attemptHlsWithRetry(); // Function ko background me call kar diya
//     }


//     // ==========================================
//     // 4. CACHE INVALIDATION & HASHTAGS
//     // ==========================================
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

// trim with video
// export const createPost = async (req, res) => {
//   try {
//     console.log("🕵️‍♂️ [DEBUG] Create Post Frontend Payload:", req.body);

//     const { type, content, caption, isSaved, duration, location } = req.body;
    
//     console.log("🕵️‍♂️ [DEBUG] Raw Video Duration received:", duration);
//     console.log("🕵️‍♂️ [DEBUG] Raw Location received:", location);

//     const userId = req.user.id;
//     const cleanType = type?.toLowerCase();
//     const isSavedBool = isSaved === "true" || isSaved === true;

//     let mediaUrls = [];
//     let thumbnail = null; 
//     let backgroundAudios = [];
//     let parsedDoodlePaths = [];
//     let uploadedVideoFileName = null;

//     // ==========================================
//     // 🔥 PRO-LEVEL: MAIN MEDIA TRIM PARAMS (Audio & Video)
//     // ==========================================
//     let mainTrimStart = 0;
//     let mainTrimDuration = null;
//     if ((cleanType === 'audio' || cleanType === 'video') && content) {
//         try {
//             const parsedContent = typeof content === "string" ? JSON.parse(content) : content;
//             if (parsedContent.trimStartSecs !== undefined) mainTrimStart = parseFloat(parsedContent.trimStartSecs);
//             if (parsedContent.durationSecs !== undefined) mainTrimDuration = parseFloat(parsedContent.durationSecs);
//             console.log(`✂️ [MAIN MEDIA TRIM] Start: ${mainTrimStart}s, Duration: ${mainTrimDuration}s`);
//         } catch (e) {
//             console.error("⚠️ Failed to parse main media trim metadata:", e.message);
//         }
//     }

//     // ==========================================
//     // 🎨 0. DOODLE RASTERIZATION
//     // ==========================================
//     if (cleanType === "doodle" && content) {
//       try {
//         parsedDoodlePaths = typeof content === "string" ? JSON.parse(content) : content;
//         if (Array.isArray(parsedDoodlePaths) && parsedDoodlePaths.length > 0) {
//           const imageBuffer = await generateDoodleImage(parsedDoodlePaths);
//           if (imageBuffer) {
//             const fileName = `post_doodles_rendered/doodle_${userId}_${Date.now()}.webp`;
//             const blob = bucket.file(fileName);
//             await blob.save(imageBuffer, { metadata: { contentType: 'image/webp' } });

//             const doodleImageUrl = `${CDN_BASE_URL}/${fileName}`;
//             thumbnail = doodleImageUrl; 
//             mediaUrls.push(doodleImageUrl); 
//             console.log("✅ Doodle Successfully Rendered to WebP:", doodleImageUrl);
//           }
//         }
//       } catch (e) {
//         console.error("⚠️ Doodle paths parse or render error:", e);
//       }
//     }

//     // ==========================================
//     // 1. BACKGROUND MUSIC HANDLING (Trimming + Fast-Start)
//     // ==========================================
//     if (req.files && req.files.backgroundMusic && req.files.backgroundMusic.length > 0) {
//       const musicFile = req.files.backgroundMusic[0];
      
//       let calculatedAudioDuration = 0;
//       const tempAudioPath = path.join(os.tmpdir(), `temp_bgm_${Date.now()}.mp4`);
//       const processedAudioPath = path.join(os.tmpdir(), `processed_bgm_${Date.now()}.mp4`);
//       let uploadBuffer = musicFile.buffer; 

//       // 🔥 BGM TRIM PARAMS (Frontend should send bgmTrimStart / bgmDuration if they want)
//       let bgmTrimStart = req.body.bgmTrimStart ? parseFloat(req.body.bgmTrimStart) : 0;
//       let bgmTrimDuration = req.body.bgmDuration ? parseFloat(req.body.bgmDuration) : null;
      
//       try {
//         fs.writeFileSync(tempAudioPath, musicFile.buffer);

//         // 🔥 Fast-Start + Trimming
//         await new Promise((resolve, reject) => {
//           let ffCommand = ffmpeg(tempAudioPath);
//           if (bgmTrimStart > 0) ffCommand = ffCommand.setStartTime(bgmTrimStart);
//           if (bgmTrimDuration > 0) ffCommand = ffCommand.setDuration(bgmTrimDuration);

//           ffCommand.outputOptions(['-c', 'copy', '-movflags', '+faststart'])
//             .save(processedAudioPath)
//             .on('end', resolve)
//             .on('error', reject);
//         });

//         uploadBuffer = fs.readFileSync(processedAudioPath);
//         calculatedAudioDuration = await getVideoDuration(processedAudioPath); // Get trimmed duration

//       } catch (e) {
//         console.error("⚠️ Backend BGM Fast-Start/Trim Error:", e.message);
//         calculatedAudioDuration = await getVideoDuration(tempAudioPath).catch(() => 0); // Fallback
//       } finally {
//         if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
//         if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
//       }

//       const folderName = 'background_music';
//       const fileName = `${folderName}/user_${userId}_${Date.now()}_music`;
//       const blob = bucket.file(fileName);
      
//       await blob.save(uploadBuffer, { 
//         metadata: { contentType: musicFile.mimetype },
//         resumable: uploadBuffer.length > 5 * 1024 * 1024,
//       });
      
//       const fileUrl = `${CDN_BASE_URL}/${fileName}`;
//       backgroundAudios = [{
//         url: fileUrl,
//         duration: parseFloat(parseFloat(calculatedAudioDuration).toFixed(2)) 
//       }];
//     } 
//     // (Aapka req.body.backgroundMusicUrl wala fallback logic chupa diya hai space ke liye, wo waisa hi rahega)
//     else if (req.body.backgroundMusicUrl || req.body.backgroundAudios) {
//       // ... Your existing rawInput fallback logic ...
//     }

//     // ==========================================
//     // 2. MAIN MEDIA UPLOAD (Audio & Video TRIMMING + Fast-Start)
//     // ==========================================
//     if (req.files && req.files.media && req.files.media.length > 0) {
//       const uploadPromises = req.files.media.map(async (file, index) => {
//         let folderName = 'post_images'; 
//         let isVideo = file.mimetype.startsWith('video');
//         let isAudio = file.mimetype.startsWith('audio');

//         if (isVideo) folderName = 'post_videos';
//         else if (isAudio) folderName = 'post_audios';

//         const rawFileNameWithoutPath = `user_${userId}_${Date.now()}_${index}`;
//         const fileName = `${folderName}/${rawFileNameWithoutPath}`;
        
//         if (isVideo) uploadedVideoFileName = fileName; 
        
//         const blob = bucket.file(fileName);
//         let calculatedMediaDuration = 0;
//         let uploadBuffer = file.buffer; 

//         // 🔥 VIDEO & AUDIO dono par FFmpeg chalega
//         if (isAudio || isVideo) {
//           const ext = isVideo ? 'mp4' : 'mp3'; // temporary extension
//           const tempPath = path.join(os.tmpdir(), `temp_media_${Date.now()}_${index}.${ext}`);
//           const processedPath = path.join(os.tmpdir(), `processed_media_${Date.now()}_${index}.${ext}`);
          
//           try {
//             fs.writeFileSync(tempPath, file.buffer);

//             // ✂️ Apply Trim & Fast-Start
//             await new Promise((resolve, reject) => {
//               let ffCommand = ffmpeg(tempPath);
//               if (mainTrimStart > 0) ffCommand = ffCommand.setStartTime(mainTrimStart);
//               if (mainTrimDuration > 0) ffCommand = ffCommand.setDuration(mainTrimDuration);

//               ffCommand.outputOptions(['-c', 'copy', '-movflags', '+faststart'])
//                 .save(processedPath)
//                 .on('end', resolve)
//                 .on('error', reject);
//             });

//             uploadBuffer = fs.readFileSync(processedPath); 
//             calculatedMediaDuration = await getVideoDuration(processedPath); 
//             console.log(`✅ [SUCCESS] Media (Video/Audio) Trimmed & Fast-Start applied! Duration: ${calculatedMediaDuration}s`);
            
//             // 🖼️ NAYA LOGIC: Thumbnail trimmed video se nikalenge
//             if (isVideo && !thumbnail) {
//               const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
//               try {
//                 await new Promise((resolve, reject) => {
//                   ffmpeg(processedPath) // Use PROCESSED (trimmed) path here!
//                     .inputOptions('-threads 2')
//                     .screenshots({
//                       count: 1, timemarks: ['00:00:01'], filename: path.basename(tempThumbPath),
//                       folder: os.tmpdir(), size: '640x?'
//                     })
//                     .on('end', resolve).on('error', reject);
//                 });

//                 const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
//                 const thumbBlob = bucket.file(thumbFileName);
//                 await thumbBlob.save(fs.readFileSync(tempThumbPath), { metadata: { contentType: 'image/jpeg' } });
//                 thumbnail = `${CDN_BASE_URL}/${thumbFileName}`;
//               } catch (thumbErr) {
//                 console.error("⚠️ Thumbnail extraction failed:", thumbErr);
//               } finally {
//                 if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
//               }
//             }

//           } catch (e) {
//             console.error("⚠️ Backend Media Trim Error:", e.message);
//             calculatedMediaDuration = await getVideoDuration(tempPath).catch(() => 0);
//           } finally {
//             if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
//             if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
//           }
//         }

//         // Final Upload to GCP
//         await blob.save(uploadBuffer, {
//           metadata: { contentType: file.mimetype },
//           resumable: uploadBuffer.length > 5 * 1024 * 1024,
//         });

//         const fileUrl = `${CDN_BASE_URL}/${fileName}`;

//         if (isAudio) {
//           backgroundAudios.push({
//             url: fileUrl,
//             duration: parseFloat(parseFloat(calculatedMediaDuration).toFixed(2))
//           });
//           return null; 
//         }

//         return fileUrl;
//       });

//       const results = await Promise.all(uploadPromises);
//       const filteredResults = results.filter(url => url !== null);
//       mediaUrls = [...mediaUrls, ...filteredResults];
//     }

//     // ==========================================
//     // 3. VALIDATION & DATABASE SAVE
//     // ==========================================
//     const mediaRequiredTypes = ["image", "video", "audio"];
//     if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0 && (!backgroundAudios || backgroundAudios.length === 0)) {
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
//       location: location || null,
//       isSaved: isSavedBool,
//       expiresAt,
//       // Main duration will be updated if it's video
//       duration: duration ? parseInt(duration, 10) : 0,  
//       backgroundAudios, 
//     });
    
//     // ==========================================
//     // 🚨 3.5. HLS CONVERSION LOGIC
//     // ==========================================
//     if (cleanType === 'video' && uploadedVideoFileName) {
//         const attemptHlsWithRetry = async (retries = 3) => {
//             for (let i = 1; i <= retries; i++) {
//                 try {
//                     const hlsUrl = await startHlsConversion(uploadedVideoFileName, post.id);
//                     if (hlsUrl) {
//                         await post.update({ mediaUrls: [hlsUrl] });
//                         console.log(`✅ [HLS SUCCESS] Post ${post.id} updated!`);
//                         if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
//                         return;
//                     }
//                 } catch (err) {
//                     console.error(`⚠️ [HLS ATTEMPT ${i} FAILED]:`, err.message);
//                     if (i === retries) {
//                         console.error(`❌ [CRITICAL] HLS permanently failed for Post ${post.id}`);
//                     } else {
//                         await new Promise(res => setTimeout(res, 5000));
//                     }
//                 }
//             }
//         };
//         attemptHlsWithRetry(); 
//     }

//     // ==========================================
//     // 4. CACHE INVALIDATION & HASHTAGS
//     // ==========================================
//     if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
    
//     await processHashtags({ caption, postId: post.id });
    
//     return res.status(201).json({ success: true, message: "Post created!", post });

//   } catch (error) {
//     console.error("Create Post Error:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
//   }
// };

// trim only in audio and caption audio
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
    let parsedDoodlePaths = [];
    let uploadedVideoFileName = null;

    // ==========================================
    // 🔥 AUDIO POST TRIM PARAMS
    // ==========================================
    let audioTrimStart = 0;
    let audioTrimDuration = null;
    // Sirf Audio type ke liye trim params nikalenge
    if (cleanType === 'audio' && content) {
        try {
            const parsedContent = typeof content === "string" ? JSON.parse(content) : content;
            if (parsedContent.trimStartSecs !== undefined) audioTrimStart = parseFloat(parsedContent.trimStartSecs);
            if (parsedContent.durationSecs !== undefined) audioTrimDuration = parseFloat(parsedContent.durationSecs);
            console.log(`✂️ [AUDIO POST TRIM] Start: ${audioTrimStart}s, Duration: ${audioTrimDuration}s`);
        } catch (e) {
            console.error("⚠️ Failed to parse audio trim metadata:", e.message);
        }
    }

    // ==========================================
    // 🎨 0. DOODLE RASTERIZATION
    // ==========================================
    if (cleanType === "doodle" && content) {
      try {
        parsedDoodlePaths = typeof content === "string" ? JSON.parse(content) : content;
        if (Array.isArray(parsedDoodlePaths) && parsedDoodlePaths.length > 0) {
          const imageBuffer = await generateDoodleImage(parsedDoodlePaths);
          if (imageBuffer) {
            const fileName = `post_doodles_rendered/doodle_${userId}_${Date.now()}.webp`;
            const blob = bucket.file(fileName);
            await blob.save(imageBuffer, { metadata: { contentType: 'image/webp' } });

            const doodleImageUrl = `${CDN_BASE_URL}/${fileName}`;
            thumbnail = doodleImageUrl; 
            mediaUrls.push(doodleImageUrl); 
            console.log("✅ Doodle Successfully Rendered to WebP:", doodleImageUrl);
          }
        }
      } catch (e) {
        console.error("⚠️ Doodle paths parse or render error:", e);
      }
    }

    // ==========================================
    // 1. BACKGROUND MUSIC HANDLING (Caption Audio Trimming + Fast-Start)
    // ==========================================
    if (req.files && req.files.backgroundMusic && req.files.backgroundMusic.length > 0) {
      const musicFile = req.files.backgroundMusic[0];
      
      let calculatedAudioDuration = 0;
      const tempAudioPath = path.join(os.tmpdir(), `temp_bgm_${Date.now()}.mp4`);
      const processedAudioPath = path.join(os.tmpdir(), `processed_bgm_${Date.now()}.mp4`);
      let uploadBuffer = musicFile.buffer; 

      // 🔥 BGM TRIM PARAMS (Frontend yahan data bhejega)
      let bgmTrimStart = req.body.bgmTrimStart ? parseFloat(req.body.bgmTrimStart) : 0;
      let bgmTrimDuration = req.body.bgmDuration ? parseFloat(req.body.bgmDuration) : null;
      
      try {
        fs.writeFileSync(tempAudioPath, musicFile.buffer);

        // ✂️ BGM Fast-Start + Trimming
        await new Promise((resolve, reject) => {
          let ffCommand = ffmpeg(tempAudioPath);
          if (bgmTrimStart > 0) ffCommand = ffCommand.setStartTime(bgmTrimStart);
          if (bgmTrimDuration > 0) ffCommand = ffCommand.setDuration(bgmTrimDuration);

          ffCommand.outputOptions(['-c', 'copy', '-movflags', '+faststart'])
            .save(processedAudioPath)
            .on('end', resolve)
            .on('error', reject);
        });

        uploadBuffer = fs.readFileSync(processedAudioPath);
        calculatedAudioDuration = await getVideoDuration(processedAudioPath); // Get trimmed duration
        console.log(`✅ [SUCCESS] Caption Audio (BGM) Trimmed! Duration: ${calculatedAudioDuration}s`);

      } catch (e) {
        console.error("⚠️ Backend BGM Trim Error:", e.message);
        calculatedAudioDuration = await getVideoDuration(tempAudioPath).catch(() => 0); // Fallback
      } finally {
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
      }

      const folderName = 'background_music';
      const fileName = `${folderName}/user_${userId}_${Date.now()}_music`;
      const blob = bucket.file(fileName);
      
      await blob.save(uploadBuffer, { 
        metadata: { contentType: musicFile.mimetype },
        resumable: uploadBuffer.length > 5 * 1024 * 1024,
      });
      
      const fileUrl = `${CDN_BASE_URL}/${fileName}`;
      backgroundAudios = [{
        url: fileUrl,
        duration: parseFloat(parseFloat(calculatedAudioDuration).toFixed(2)) 
      }];
    } 
    else if (req.body.backgroundMusicUrl || req.body.backgroundAudios) {
      const rawInput = req.body.backgroundMusicUrl || req.body.backgroundAudios;
      const fallbackDuration = req.body.audioDuration || req.body.backgroundMusicDuration || duration || 0;
      try {
        if (typeof rawInput === "string") {
          const parsed = JSON.parse(rawInput);
          if (Array.isArray(parsed)) {
            backgroundAudios = parsed.map(item => ({
              url: item.url || "",
              duration: item.duration !== undefined ? parseFloat(item.duration) : parseFloat(fallbackDuration)
            }));
          } else if (typeof parsed === "object" && parsed !== null) {
            backgroundAudios = [{ url: parsed.url || "", duration: parsed.duration !== undefined ? parseFloat(parsed.duration) : parseFloat(fallbackDuration) }];
          } else {
            backgroundAudios = [{ url: rawInput, duration: parseFloat(fallbackDuration) }];
          }
        } else if (Array.isArray(rawInput)) {
          backgroundAudios = rawInput.map(item => ({ url: item.url || "", duration: item.duration !== undefined ? parseFloat(item.duration) : parseFloat(fallbackDuration) }));
        } else if (typeof rawInput === "object" && rawInput !== null) {
          backgroundAudios = [{ url: rawInput.url || "", duration: rawInput.duration !== undefined ? parseFloat(rawInput.duration) : parseFloat(fallbackDuration) }];
        }
      } catch (e) {
        backgroundAudios = [{ url: rawInput, duration: parseFloat(fallbackDuration) }];
      }
    }

    // ==========================================
    // 2. MAIN MEDIA UPLOAD
    // ==========================================
    if (req.files && req.files.media && req.files.media.length > 0) {
      const uploadPromises = req.files.media.map(async (file, index) => {
        let folderName = 'post_images'; 
        let isVideo = file.mimetype.startsWith('video');
        let isAudio = file.mimetype.startsWith('audio');

        if (isVideo) folderName = 'post_videos';
        else if (isAudio) folderName = 'post_audios';

        const rawFileNameWithoutPath = `user_${userId}_${Date.now()}_${index}`;
        const fileName = `${folderName}/${rawFileNameWithoutPath}`;
        
        if (isVideo) uploadedVideoFileName = fileName; 
        
        const blob = bucket.file(fileName);
        let calculatedMediaAudioDuration = 0;
        let uploadBuffer = file.buffer; // Raw buffer

        // 🎵 AUDIO HANDLING: Apply Trim & Fast-Start
        if (isAudio) {
          const tempAudioPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}_${index}.mp4`);
          const processedAudioPath = path.join(os.tmpdir(), `processed_audio_${Date.now()}_${index}.mp4`);
          
          try {
            fs.writeFileSync(tempAudioPath, file.buffer);

            await new Promise((resolve, reject) => {
              let ffCommand = ffmpeg(tempAudioPath);
              if (audioTrimStart > 0) ffCommand = ffCommand.setStartTime(audioTrimStart);
              if (audioTrimDuration > 0) ffCommand = ffCommand.setDuration(audioTrimDuration);

              ffCommand.outputOptions(['-c', 'copy', '-movflags', '+faststart'])
                .save(processedAudioPath)
                .on('end', resolve)
                .on('error', reject);
            });

            uploadBuffer = fs.readFileSync(processedAudioPath); 
            calculatedMediaAudioDuration = await getVideoDuration(processedAudioPath); 
            console.log(`✅ [SUCCESS] Audio Post Trimmed & Fast-Start applied! Duration: ${calculatedMediaAudioDuration}s`);
            
          } catch (e) {
            console.error("⚠️ Backend Audio Trim Error:", e.message);
            calculatedMediaAudioDuration = await getVideoDuration(tempAudioPath).catch(() => 0);
          } finally {
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
          }
        }

        // 🎥 VIDEO HANDLING: Original Flow (No Trimming, just extract thumbnail)
        if (isVideo && !thumbnail) {
          const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}_${index}.mp4`);
          const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
          
          try {
            fs.writeFileSync(tempVideoPath, file.buffer);

            await new Promise((resolve, reject) => {
              ffmpeg(tempVideoPath)
                .inputOptions('-threads 2')
                .screenshots({
                  count: 1, timemarks: ['00:00:01'], filename: path.basename(tempThumbPath),
                  folder: os.tmpdir(), size: '640x?'
                })
                .on('end', resolve).on('error', reject);
            });

            const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
            const thumbBlob = bucket.file(thumbFileName);
            await thumbBlob.save(fs.readFileSync(tempThumbPath), { metadata: { contentType: 'image/jpeg' } });
            thumbnail = `${CDN_BASE_URL}/${thumbFileName}`;

          } catch (thumbErr) {
            console.error("⚠️ Thumbnail extraction failed:", thumbErr);
          } finally {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
          }
        }

        // Final Upload to GCP
        await blob.save(uploadBuffer, {
          metadata: { contentType: file.mimetype },
          resumable: uploadBuffer.length > 5 * 1024 * 1024,
        });

        const fileUrl = `${CDN_BASE_URL}/${fileName}`;

        if (isAudio) {
          backgroundAudios.push({
            url: fileUrl,
            duration: parseFloat(parseFloat(calculatedMediaAudioDuration).toFixed(2))
          });
          return null; 
        }

        return fileUrl;
      });

      const results = await Promise.all(uploadPromises);
      const filteredResults = results.filter(url => url !== null);
      mediaUrls = [...mediaUrls, ...filteredResults];
    }

    // ==========================================
    // 3. VALIDATION & DATABASE SAVE
    // ==========================================
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
    
    // ==========================================
    // 🚨 3.5. HLS CONVERSION LOGIC
    // ==========================================
    if (cleanType === 'video' && uploadedVideoFileName) {
        const attemptHlsWithRetry = async (retries = 3) => {
            for (let i = 1; i <= retries; i++) {
                try {
                    const hlsUrl = await startHlsConversion(uploadedVideoFileName, post.id);
                    if (hlsUrl) {
                        await post.update({ mediaUrls: [hlsUrl] });
                        console.log(`✅ [HLS SUCCESS] Post ${post.id} updated!`);
                        if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
                        return;
                    }
                } catch (err) {
                    console.error(`⚠️ [HLS ATTEMPT ${i} FAILED]:`, err.message);
                    if (i === retries) {
                        console.error(`❌ [CRITICAL] HLS permanently failed for Post ${post.id}`);
                    } else {
                        await new Promise(res => setTimeout(res, 5000));
                    }
                }
            }
        };
        attemptHlsWithRetry(); 
    }

    // ==========================================
    // 4. CACHE INVALIDATION & HASHTAGS
    // ==========================================
    if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
    
    await processHashtags({ caption, postId: post.id });
    
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

    await markExpiredPosts(userId);

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

export const markExpiredPosts = async (specificUserId = null) => {
  try {
    const now = new Date();
    const whereCondition = { 
      isSaved: false, 
      status: "active", 
      expiresAt: { [Op.lte]: now } 
    };

    if (specificUserId) {
      whereCondition.userId = specificUserId;
    }

    const postsToArchive = await Post.findAll({
      where: whereCondition,
      attributes: ["id", "userId"]
    });

    if (postsToArchive.length > 0) {
      const [updatedRows] = await Post.update(
        { status: "archived", expiresAt: null },
        { where: whereCondition }
      );

      if (redisClient?.isReady) {
        const uniqueUserIds = [...new Set(postsToArchive.map(p => p.userId))];
        for (const uid of uniqueUserIds) {
          await redisClient.del(`archivedPosts:${uid}`);
          await redisClient.del(`userPosts:${uid}`);
        }
      }
      console.log(`✅ Archived ${updatedRows} posts dynamically`);
    }
  } catch (error) {
    console.error("MARK EXPIRED POSTS ERROR:", error);
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

    const profileOwner = await User.findByPk(id, {
      attributes: ["id", "isPrivate"]
    });

    const isTargetPrivate = profileOwner ? (profileOwner.isPrivate === true || profileOwner.isPrivate === "true" || profileOwner.isPrivate === 1 || profileOwner.isPrivate === "1") : false;

    let canViewProfile = !isTargetPrivate;

    if (currentUserId && String(currentUserId) === String(id)) {
      canViewProfile = true;
    }
    if (req.user && req.user.role === "admin") {
      canViewProfile = true;
    }

    if (!canViewProfile && currentUserId) {
      const [isFollowing, followsYou] = await Promise.all([
        Follower.findOne({
          where: {
            followerId: currentUserId,
            followingId: id,
            status: "accepted"
          }
        }),
        Follower.findOne({
          where: {
            followerId: id,
            followingId: currentUserId,
            status: "accepted"
          }
        })
      ]);

      canViewProfile = !!isFollowing || !!followsYou;
    }

    if (!canViewProfile) {
      return res.json({
        success: true,
        count: 0,
        posts: [],
        canViewProfile: false
      });
    }

    if (redisClient?.isReady) {
      try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          console.log(`🧠 [CACHE HIT] ${cacheKey} viewer=${currentUserId || 'anon'} owner=${id}`);
          const parsed = JSON.parse(cachedData);
          const finalizedCached = await injectIsLikedFlag(parsed, currentUserId);
          return res.json({
            success: true,
            count: finalizedCached.length,
            posts: finalizedCached,
            canViewProfile: true,
            cached: true
          });
        }
      } catch (cacheErr) {
        console.error('⚠️ Redis read error in getUserPosts:', cacheErr.message);
      }
    }

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
      posts: canViewProfile ? finalizedPosts : [],
      canViewProfile
    });

  } catch (error) {
    console.error("Get user posts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user posts"
    });
  }
};