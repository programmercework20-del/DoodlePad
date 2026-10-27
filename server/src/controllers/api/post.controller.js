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
// 📐 HELPER: Probe Video Orientation, Rotation, SAR & Target HLS Dimensions
// ==========================================
function probeVideoDimensions(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata || !Array.isArray(metadata.streams)) {
        console.warn("⚠️ [FFPROBE WARNING] Could not read video metadata:", err?.message);
        return resolve(null);
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) return resolve(null);

      let rawWidth = parseInt(videoStream.width, 10) || 0;
      let rawHeight = parseInt(videoStream.height, 10) || 0;
      if (!rawWidth || !rawHeight) return resolve(null);

      // 1. Account for Sample Aspect Ratio (SAR) if non-square pixels are used
      if (
        videoStream.sample_aspect_ratio &&
        videoStream.sample_aspect_ratio !== "0:1" &&
        videoStream.sample_aspect_ratio !== "1:1"
      ) {
        const [sarW, sarH] = videoStream.sample_aspect_ratio.split(":").map(Number);
        if (sarW > 0 && sarH > 0) {
          rawWidth = Math.round((rawWidth * sarW) / sarH);
        }
      }

      // 2. Account for Rotation metadata (stream tags or display matrix in side_data_list)
      let rotation = 0;
      if (videoStream.tags && videoStream.tags.rotate !== undefined) {
        rotation = parseInt(videoStream.tags.rotate, 10) || 0;
      } else if (Array.isArray(videoStream.side_data_list)) {
        const rotationSideData = videoStream.side_data_list.find((d) => d.rotation !== undefined);
        if (rotationSideData) {
          rotation = parseInt(rotationSideData.rotation, 10) || 0;
        }
      }

      const absRotation = Math.abs(rotation) % 360;
      const isRotated90or270 = absRotation === 90 || absRotation === 270;

      // Effective decoded frame dimensions after rotation is applied
      const effectiveWidth = isRotated90or270 ? rawHeight : rawWidth;
      const effectiveHeight = isRotated90or270 ? rawWidth : rawHeight;

      const isLandscape = effectiveWidth > effectiveHeight;
      const orientation = isLandscape ? "landscape" : "portrait";

      // 3. Scale within max bounding box (1280x720 for landscape, 720x1280 for portrait)
      // Preserves exact aspect ratio (16:9 -> 1280x720, 4:3 -> 960x720, 9:16 -> 720x1280)
      const maxW = isLandscape ? 1280 : 720;
      const maxH = isLandscape ? 720 : 1280;
      const scale = Math.min(maxW / effectiveWidth, maxH / effectiveHeight, 1);

      // Ensure encoder-compatible even dimensions
      const widthPixels = Math.max(2, Math.round((effectiveWidth * scale) / 2) * 2);
      const heightPixels = Math.max(2, Math.round((effectiveHeight * scale) / 2) * 2);

      resolve({
        rawWidth,
        rawHeight,
        rotation,
        effectiveWidth,
        effectiveHeight,
        orientation,
        widthPixels,
        heightPixels
      });
    });
  });
}

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

export const createPost = async (req, res) => {
  try {
    // ⏱️ PERF: Start Timer
    const { performance } = await import('perf_hooks');
    const tStart = performance.now();
    const timeLog = {};

    console.log("🕵️‍♂️ [DEBUG] Create Post Frontend Payload:", req.body);

    const { type, content, caption, isSaved, duration, location } = req.body;
    const userId = req.user.id;
    const cleanType = type?.toLowerCase();
    const isSavedBool = isSaved === "true" || isSaved === true;

    let mediaUrls = [];
    let thumbnail = null; 
    let backgroundAudios = [];
    let parsedDoodlePaths = [];
    
    // 🔥 Variable Audio/Video filename & orientation track karne ke liye
    let uploadedVideoFileName = null;
    let uploadedAudioFileName = null; 
    let detectedVideoOrientation = req.body.orientation?.toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
    let detectedVideoDimensions = null;

    timeLog['Multipart_Parsing'] = (performance.now() - tStart).toFixed(2) + "ms";

    // ==========================================
    // 🔥 AUDIO POST TRIM PARAMS
    // ==========================================
    let audioTrimStart = 0;
    let audioTrimDuration = null;
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
    const tDoodleStart = performance.now();
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
          }
        }
      } catch (e) {
        console.error("⚠️ Doodle paths parse error:", e);
      }
    }
    timeLog['Sharp_Doodle'] = (performance.now() - tDoodleStart).toFixed(2) + "ms";

    // ==========================================
    // 1. BACKGROUND MUSIC HANDLING
    // ==========================================
    const tBgmStart = performance.now();
    if (req.files && req.files.backgroundMusic && req.files.backgroundMusic.length > 0) {
      const musicFile = req.files.backgroundMusic[0];
      let originalExt = path.extname(musicFile.originalname).toLowerCase();
      let bgmExt = '.m4a'; // Forced to .m4a

      let calculatedAudioDuration = 0;
      const tempAudioPath = path.join(os.tmpdir(), `temp_bgm_${Date.now()}${originalExt || '.mp3'}`);
      const processedAudioPath = path.join(os.tmpdir(), `processed_bgm_${Date.now()}${bgmExt}`);
      let uploadBuffer = musicFile.buffer; 

      let bgmTrimStart = req.body.bgmTrimStart ? parseFloat(req.body.bgmTrimStart) : 0;
      let bgmTrimDuration = req.body.bgmDuration ? parseFloat(req.body.bgmDuration) : null;
      
      try {
        fs.writeFileSync(tempAudioPath, musicFile.buffer);

        await new Promise((resolve, reject) => {
          let ffCommand = ffmpeg(tempAudioPath);
          if (bgmTrimStart > 0) ffCommand = ffCommand.setStartTime(bgmTrimStart);
          if (bgmTrimDuration > 0) ffCommand = ffCommand.setDuration(bgmTrimDuration);

          // 🔥 MAGIC FIX: Added '-vn' to ignore album cover art in fallback flow
          ffCommand.outputOptions(['-c:a', 'aac', '-b:a', '128k', '-vn', '-movflags', '+faststart'])
            .save(processedAudioPath)
            .on('end', resolve)
            .on('error', reject);
        });

        uploadBuffer = fs.readFileSync(processedAudioPath);
        calculatedAudioDuration = await getVideoDuration(processedAudioPath); 

      } catch (e) {
        console.error("⚠️ Backend BGM Trim Error:", e.message);
        throw new Error("BGM Audio trimming failed. Request aborted."); 
      } finally {
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
      }

      const fileName = `background_music/user_${userId}_${Date.now()}_music${bgmExt}`;
      await bucket.file(fileName).save(uploadBuffer, { 
        metadata: { contentType: 'audio/mp4' },
        resumable: uploadBuffer.length > 5 * 1024 * 1024,
      });
      
      backgroundAudios = [{
        url: `${CDN_BASE_URL}/${fileName}`,
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
              backgroundAudios = parsed.map(item => ({ url: item.url || "", duration: item.duration !== undefined ? parseFloat(item.duration) : parseFloat(fallbackDuration) }));
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
    timeLog['BGM_Process_Upload'] = (performance.now() - tBgmStart).toFixed(2) + "ms";

    // ==========================================
    // 2. MAIN MEDIA UPLOAD
    // ==========================================
   const tMediaStart = performance.now();

    // 🔥 NAYA FLOW (GCP Direct Upload via Frontend)
    if (req.body.uploadedFileName || req.body.backgroundMusic) {
      let isVideo = cleanType === 'video';
      let isAudio = cleanType === 'audio';

      // 1. Handle Main Media (Audio/Video/Image)
      if (req.body.uploadedFileName) {
        let fileName = req.body.uploadedFileName;
        let fileUrl = `${CDN_BASE_URL}/${fileName}`;

        if (isAudio && (audioTrimStart > 0 || audioTrimDuration > 0)) {
           const tempInput = path.join(os.tmpdir(), `raw_main_${Date.now()}.m4a`);
           const tempOutput = path.join(os.tmpdir(), `trimmed_main_${Date.now()}.m4a`);
           try {
               await bucket.file(fileName).download({ destination: tempInput });
               
               // 🛡️ SAFETY CHECK 1 (Main Audio): File corrupt ya khali toh nahi hai?
               const statsMain = fs.statSync(tempInput);
               if (statsMain.size === 0) {
                   throw new Error("Uploaded Main Audio file is corrupt or 0 bytes.");
               }

               // 🛡️ SAFETY CHECK 2 (Main Audio): Duration validation
               const actualMainDuration = await getVideoDuration(tempInput); 
               if (actualMainDuration && audioTrimStart >= actualMainDuration) {
                   console.log(`⚠️ [WARNING] audioTrimStart (${audioTrimStart}s) actual duration se bada hai. Resetting to 0.`);
                   audioTrimStart = 0; 
               }
               
               await new Promise((resolve, reject) => {
                 let ffCommand = ffmpeg(tempInput);
                 
                 if (audioTrimStart > 0) ffCommand = ffCommand.setStartTime(audioTrimStart);
                 
                 // Safe Duration Logic
                 if (audioTrimDuration > 0 && audioTrimStart + audioTrimDuration <= actualMainDuration) {
                     ffCommand = ffCommand.setDuration(audioTrimDuration);
                 } else if (audioTrimDuration > 0) {
                     ffCommand = ffCommand.setDuration(actualMainDuration - audioTrimStart);
                 }

                 // 🔥 MAGIC FIX: Added '-vn' to ignore album cover art in Main Audio
                 ffCommand.outputOptions(['-c:a', 'aac', '-b:a', '128k', '-vn', '-movflags', '+faststart'])
                   .save(tempOutput).on('end', resolve).on('error', reject);
               });

               const trimmedFileName = `post_audios/trimmed_${userId}_${Date.now()}.m4a`;
               const trimmedBuffer = fs.readFileSync(tempOutput);
               
               await bucket.file(trimmedFileName).save(trimmedBuffer, { metadata: { contentType: 'audio/mp4' } });

               fileName = trimmedFileName; 
               fileUrl = `${CDN_BASE_URL}/${fileName}`; 
               console.log(`✅ Main Audio physically trimmed safely & saved: ${fileUrl}`);
           } catch (e) {
               console.error("⚠️ Main Audio GCP Trim Error:", e);
               throw new Error(`FFmpeg Main Audio Trimming Failed: ${e.message}`);
           } finally {
               if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
               if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
           }
        }

        // 🔥 MAGIC FIX: GENERATE THUMBNAIL & PROBE ORIENTATION FOR VIDEO IN DIRECT UPLOAD FLOW
        if (isVideo) {
          uploadedVideoFileName = fileName;
          
          const tempVideoDlPath = path.join(os.tmpdir(), `dl_vid_${Date.now()}.mp4`);
          const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
          
          try {
            console.log(`📸 [THUMBNAIL & PROBE] Inspecting direct uploaded video: ${fileName}`);
            
            // 1. Download video from bucket to temp folder
            await bucket.file(fileName).download({ destination: tempVideoDlPath });

            // 2. 🔥 PROBE ACTUAL VIDEO STREAM ORIENTATION & DIMENSIONS
            const probedMeta = await probeVideoDimensions(tempVideoDlPath);
            if (probedMeta) {
              detectedVideoOrientation = probedMeta.orientation;
              detectedVideoDimensions = {
                widthPixels: probedMeta.widthPixels,
                heightPixels: probedMeta.heightPixels
              };
              console.log(
                `📐 [VIDEO PROBE] Raw: ${probedMeta.rawWidth}x${probedMeta.rawHeight} (rot: ${probedMeta.rotation}°) ` +
                `→ Effective: ${probedMeta.effectiveWidth}x${probedMeta.effectiveHeight} (${probedMeta.orientation}) ` +
                `→ Target HLS: ${probedMeta.widthPixels}x${probedMeta.heightPixels}`
              );
            }
            
            // 3. Generate screenshot using FFmpeg
            await new Promise((resolve, reject) => {
              ffmpeg(tempVideoDlPath)
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
            
            // 4. Upload thumbnail to GCP bucket
            const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}.jpg`;
            await bucket.file(thumbFileName).save(fs.readFileSync(tempThumbPath), { 
              metadata: { contentType: 'image/jpeg' } 
            });
            
            // 5. Set thumbnail URL for database mapping
            thumbnail = `${CDN_BASE_URL}/${thumbFileName}`;
            console.log(`✅ [THUMBNAIL SUCCESS] Thumbnail generated & saved: ${thumbnail}`);
            
          } catch (e) {
             console.error("⚠️ [THUMBNAIL/PROBE ERROR] Failed on direct upload video:", e.message);
          } finally {
             // Cleanup temp files
             if (fs.existsSync(tempVideoDlPath)) fs.unlinkSync(tempVideoDlPath);
             if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
          }
        }

        if (isAudio) uploadedAudioFileName = fileName; 
        mediaUrls.push(fileUrl);
      }

      // 2. Handle Background Music (BGM Trimming)
      if (req.body.backgroundMusic) {
        let bgmFileName = req.body.backgroundMusic;
        let bgmUrl = `${CDN_BASE_URL}/${bgmFileName}`;
        
        let rawTrimStart = req.body.bgmTrimStart !== undefined ? req.body.bgmTrimStart : req.body.trimStartSecs;
        let rawTrimDuration = req.body.bgmDuration !== undefined ? req.body.bgmDuration : req.body.durationSecs;

        let bgmTrimStart = rawTrimStart !== undefined ? parseFloat(rawTrimStart) : 0;
        let bgmTrimDuration = rawTrimDuration !== undefined ? parseFloat(rawTrimDuration) : null;
        let finalDuration = bgmTrimDuration > 0 ? bgmTrimDuration : (duration ? parseFloat(duration) : 0);

        console.log(`🎵 [BGM TRIM DEBUG] File: ${bgmFileName} | Start: ${bgmTrimStart} | Duration: ${bgmTrimDuration}`);

        if (bgmTrimStart >= 0 && bgmTrimDuration > 0) {
           const tempInput = path.join(os.tmpdir(), `raw_bgm_${Date.now()}.m4a`);
           const tempOutput = path.join(os.tmpdir(), `trimmed_bgm_${Date.now()}.m4a`);
           try {
              await bucket.file(bgmFileName).download({ destination: tempInput });
              
              // 🛡️ SAFETY CHECK 1: File corrupt ya khali toh nahi hai?
              const stats = fs.statSync(tempInput);
              if (stats.size === 0) {
                  throw new Error("Uploaded BGM file is corrupt or 0 bytes.");
              }

              // 🛡️ SAFETY CHECK 2: Duration validation with NaN (Not a Number) Protection
              let actualAudioDuration = 0;
              try {
                  let durationRaw = await getVideoDuration(tempInput);
                  actualAudioDuration = parseFloat(durationRaw);
                  if (isNaN(actualAudioDuration)) actualAudioDuration = 0;
              } catch (e) {
                  console.log("⚠️ Could not read audio duration via probe, using fallback.");
              }

              if (actualAudioDuration > 0 && bgmTrimStart >= actualAudioDuration) {
                  console.log(`⚠️ [WARNING] bgmTrimStart (${bgmTrimStart}s) actual duration (${actualAudioDuration}s) se bada hai. Resetting to 0.`);
                  bgmTrimStart = 0; 
              }

              await new Promise((resolve, reject) => {
                  let ffCommand = ffmpeg(tempInput);
                  
                  if (bgmTrimStart > 0) ffCommand = ffCommand.setStartTime(bgmTrimStart);
                  
                  // 🔥 SAFE DURATION LOGIC (No NaN allowed)
                  if (bgmTrimDuration > 0) {
                      if (actualAudioDuration > 0 && (bgmTrimStart + bgmTrimDuration > actualAudioDuration)) {
                          let safeDuration = actualAudioDuration - bgmTrimStart;
                          if (safeDuration > 0) ffCommand = ffCommand.setDuration(safeDuration);
                      } else {
                          ffCommand = ffCommand.setDuration(bgmTrimDuration);
                      }
                  }

                  // 🔥 MAGIC FIX: Added '-vn' to ignore album cover art in BGM GCP flow
                  ffCommand.outputOptions(['-c:a', 'aac', '-b:a', '128k', '-vn', '-movflags', '+faststart'])
                      .save(tempOutput).on('end', resolve).on('error', reject);
              });

               const trimmedFileName = `background_music/trimmed_${userId}_${Date.now()}.m4a`;
               const trimmedBuffer = fs.readFileSync(tempOutput);
               
               await bucket.file(trimmedFileName).save(trimmedBuffer, { metadata: { contentType: 'audio/mp4' } });

               bgmFileName = trimmedFileName; 
               bgmUrl = `${CDN_BASE_URL}/${bgmFileName}`; 
               console.log(`✅ BGM physically trimmed & saved successfully: ${bgmUrl}`);
           } catch (e) {
               console.error(`⚠️ BGM GCP Trim Error:`, e);
               throw new Error(`FFmpeg BGM Trimming Failed: ${e.message}`);
           } finally {
               if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
               if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
           }
        }
        
        backgroundAudios.push({ url: bgmUrl, duration: finalDuration });
      }
    }
    // 🐢 PURANA FLOW (Fallback - Agar file Node.js par aayi hai)
    else if (req.files && req.files.media && req.files.media.length > 0) {
      const uploadPromises = req.files.media.map(async (file, index) => {
        let isVideo = file.mimetype.startsWith('video');
        let isAudio = file.mimetype.startsWith('audio');
        let folderName = isVideo ? 'post_videos' : (isAudio ? 'post_audios' : 'post_images');
        
        let originalExt = path.extname(file.originalname).toLowerCase();
        let ext = originalExt || (isVideo ? '.mp4' : (isAudio ? '.m4a' : ''));
        if (isAudio) ext = '.m4a';

        const rawFileNameWithoutPath = `user_${userId}_${Date.now()}_${index}${ext}`;
        const fileName = `${folderName}/${rawFileNameWithoutPath}`;
        
        if (isVideo) uploadedVideoFileName = fileName; 
        if (isAudio) uploadedAudioFileName = fileName; 

        const blob = bucket.file(fileName);
        let calculatedMediaAudioDuration = 0;
        let uploadBuffer = file.buffer; 

        // 🎵 AUDIO HANDLING
        if (isAudio) {
          const tempAudioPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}_${index}${originalExt || '.mp3'}`);
          const processedAudioPath = path.join(os.tmpdir(), `processed_audio_${Date.now()}_${index}${ext}`);
          
          try {
            fs.writeFileSync(tempAudioPath, file.buffer);
            await new Promise((resolve, reject) => {
              let ffCommand = ffmpeg(tempAudioPath);
              if (audioTrimStart > 0) ffCommand = ffCommand.setStartTime(audioTrimStart);
              if (audioTrimDuration > 0) ffCommand = ffCommand.setDuration(audioTrimDuration);

              // 🔥 MAGIC FIX: Added '-vn' to ignore album cover art in fallback flow
              ffCommand.outputOptions(['-c:a', 'aac', '-b:a', '128k', '-vn', '-movflags', '+faststart'])
                .save(processedAudioPath).on('end', resolve).on('error', reject);
            });
            uploadBuffer = fs.readFileSync(processedAudioPath); 
            calculatedMediaAudioDuration = await getVideoDuration(processedAudioPath); 
          } catch (e) {
            console.error("⚠️ Backend Audio Trim Error:", e.message);
            throw new Error("Main Audio trimming failed. Request aborted.");
          } finally {
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (fs.existsSync(processedAudioPath)) fs.unlinkSync(processedAudioPath);
          }
        }

        // 🎥 VIDEO HANDLING
        if (isVideo) {
          const tempVideoPath = path.join(os.tmpdir(), `temp_${Date.now()}_${index}${ext}`); 
          const processedVideoPath = path.join(os.tmpdir(), `processed_${Date.now()}_${index}.mp4`); 
          const tempThumbPath = path.join(os.tmpdir(), `thumb_${Date.now()}_${index}.jpg`);
          
          try {
            fs.writeFileSync(tempVideoPath, file.buffer);

            // 🔥 PROBE ACTUAL VIDEO ORIENTATION & DIMENSIONS IN FALLBACK FLOW
            const probedMeta = await probeVideoDimensions(tempVideoPath);
            if (probedMeta) {
              detectedVideoOrientation = probedMeta.orientation;
              detectedVideoDimensions = {
                widthPixels: probedMeta.widthPixels,
                heightPixels: probedMeta.heightPixels
              };
              console.log(
                `📐 [VIDEO PROBE FALLBACK] Raw: ${probedMeta.rawWidth}x${probedMeta.rawHeight} (rot: ${probedMeta.rotation}°) ` +
                `→ Effective: ${probedMeta.effectiveWidth}x${probedMeta.effectiveHeight} (${probedMeta.orientation}) ` +
                `→ Target HLS: ${probedMeta.widthPixels}x${probedMeta.heightPixels}`
              );
            }

            if (!thumbnail) {
                await new Promise((resolve, reject) => {
                  ffmpeg(tempVideoPath).inputOptions('-threads 2')
                    .screenshots({ count: 1, timemarks: ['00:00:01'], filename: path.basename(tempThumbPath), folder: os.tmpdir(), size: '640x?' })
                    .on('end', resolve).on('error', reject);
                });
                const thumbFileName = `post_thumbnails/thumb_${userId}_${Date.now()}_${index}.jpg`;
                await bucket.file(thumbFileName).save(fs.readFileSync(tempThumbPath), { metadata: { contentType: 'image/jpeg' } });
                thumbnail = `${CDN_BASE_URL}/${thumbFileName}`;
            }

            await new Promise((resolve, reject) => {
              ffmpeg(tempVideoPath).outputOptions(['-c', 'copy', '-movflags', '+faststart'])
                .save(processedVideoPath).on('end', resolve).on('error', reject);
            });
            uploadBuffer = fs.readFileSync(processedVideoPath); 
          } catch (err) {
            console.error("⚠️ Video processing failed:", err);
          } finally {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(processedVideoPath)) fs.unlinkSync(processedVideoPath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
          }
        }

        // Upload to GCP
        await blob.save(uploadBuffer, {
          metadata: { contentType: isAudio ? 'audio/mp4' : file.mimetype },
          resumable: uploadBuffer.length > 5 * 1024 * 1024,
        });

        const fileUrl = `${CDN_BASE_URL}/${fileName}`;
        if (isAudio) {
          backgroundAudios.push({ url: fileUrl, duration: parseFloat(parseFloat(calculatedMediaAudioDuration).toFixed(2)) });
          return null; 
        }
        return fileUrl;
      });

      const results = await Promise.all(uploadPromises);
      mediaUrls = [...mediaUrls, ...results.filter(url => url !== null)];
    }
    timeLog['Main_Media_FFmpeg_GCP'] = (performance.now() - tMediaStart).toFixed(2) + "ms";

    // ==========================================
    // 3. VALIDATION & DATABASE SAVE
    // ==========================================
    const mediaRequiredTypes = ["image", "video", "audio"];
    if (mediaRequiredTypes.includes(cleanType) && mediaUrls.length === 0 && (!backgroundAudios || backgroundAudios.length === 0)) {
      return res.status(400).json({ success: false, message: "Media file missing" });
    }

    const tDbStart = performance.now();
    const post = await Post.create({
      userId,
      type: cleanType,
      content: cleanType === "doodle" ? (content || "Doodle Post") : content,
      caption: caption || "",
      mediaUrls, 
      thumbnail, 
      location: location || null,
      isSaved: isSavedBool,
      expiresAt: isSavedBool ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: duration ? parseInt(duration, 10) : 0,  
      backgroundAudios, 
    });
    timeLog['Database_Insert'] = (performance.now() - tDbStart).toFixed(2) + "ms";
    
    // ==========================================
    // 🚨 3.5. MEDIA PROCESSING (HLS FOR VIDEO, DIRECT M4A FOR AUDIO)
    // ==========================================
    
    // 🎥 1. ONLY VIDEO POSTS get HLS conversion (Now Orientation & Aspect-Ratio Aware!)
    if (cleanType === 'video' && uploadedVideoFileName) {
        const attemptHlsWithRetry = async (retries = 3) => {
            for (let i = 1; i <= retries; i++) {
                try {
                    const hlsUrl = await startHlsConversion(
                        uploadedVideoFileName,
                        post.id,
                        detectedVideoOrientation,
                        3,
                        'video',
                        detectedVideoDimensions
                    );
                    
                    if (hlsUrl) {
                        await post.update({ mediaUrls: [hlsUrl] });
                        console.log(`✅ [HLS SUCCESS] Post ${post.id} updated with ${detectedVideoOrientation.toUpperCase()} VIDEO HLS URL!`);
                        if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
                        return;
                    }
                } catch (err) {
                    console.error(`⚠️ [HLS ATTEMPT ${i} FAILED]:`, err.message);
                    if (i === retries) {
                        console.error(`❌ [CRITICAL] HLS permanently failed for Video Post ${post.id}`);
                    } else {
                        await new Promise(res => setTimeout(res, 5000));
                    }
                }
            }
        };
        attemptHlsWithRetry(); 
    }
    // 🎵 2. AUDIO POSTS BYPASS HLS -> Update directly with pure .m4a link
    else if (cleanType === 'audio' && uploadedAudioFileName) {
        try {
            const correctDuration = post.duration || (post.backgroundAudios && post.backgroundAudios.length > 0 ? post.backgroundAudios[0].duration : 15);
            
            const directAudioUrl = (post.mediaUrls && post.mediaUrls.length > 0) 
                ? post.mediaUrls[0] 
                : `${CDN_BASE_URL}/${uploadedAudioFileName}`;

            await post.update({ 
                backgroundAudios: [{ url: directAudioUrl, duration: correctDuration }] 
            });

            console.log(`✅ [AUDIO SUCCESS] Post ${post.id} bypassed HLS, saved direct .m4a URL: ${directAudioUrl}`);
            if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
        } catch (e) {
            console.error(`❌ [AUDIO POST FATAL ERROR] Failed to update direct audio URL:`, e.message);
        }
    }

    // ==========================================
    // 4. CACHE INVALIDATION & HASHTAGS
    // ==========================================
    if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
    await processHashtags({ caption, postId: post.id });
    
    timeLog['TOTAL_DURATION'] = (performance.now() - tStart).toFixed(2) + "ms";
    console.table(timeLog);

    return res.status(201).json({ success: true, message: "Post created!", post });

  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
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

    // ==========================================
    // 🔥 PRO-LEVEL: PIN/UNPIN FETCH LOGIC
    // ==========================================
    const posts = await Post.findAll({
      where: {
        userId: id,
        status: "active", // Sirf active posts dikhengi
        [Op.or]: [
          { isSaved: true }, // 📌 Treated as PINNED: Ye lifetime profile par rahengi
          {
            isSaved: false,  // 🔓 Treated as UNPINNED: Ye sirf tab dikhengi jab 24h timer bacha ho
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
      // 🔥 Client requirement: "most recently uploaded posts should appear at the top"
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

// ==========================================
// 🚀 NEW: GENERATE RESUMABLE UPLOAD URL (CHUNKED)
// ==========================================
export const generateResumableUploadUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileType, ext, contentType } = req.body; 

    let folderName = 'post_images';
    if (fileType === 'video') folderName = 'post_videos';
    else if (fileType === 'audio') folderName = 'post_audios';

    const rawFileName = `user_${userId}_${Date.now()}${ext || '.mp4'}`;
    const fileName = `${folderName}/${rawFileName}`;

    const file = bucket.file(fileName);

    const [uploadUrl] = await file.createResumableUpload({
      metadata: {
        contentType: contentType,
      },
      origin: '*',
    });

    return res.status(200).json({
      success: true,
      uploadUrl,
      fileName,
      mediaUrl: `${process.env.CDN_BASE_URL}/${fileName}`
    });

  } catch (error) {
    console.error("⚠️ Resumable URL Error:", error);
    res.status(500).json({ success: false, message: "Could not generate resumable upload URL" });
  }
};

// ==========================================
// 🚀 NEW: SMART PIN/UNPIN LOGIC (No DB Change)
// ==========================================
export const togglePinPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findByPk(postId);

    if (!post || post.userId !== userId) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.status === "deleted") {
      return res.status(400).json({ success: false, message: "Cannot modify a deleted post" });
    }

    if (post.isSaved) {
      const newExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await post.update({ 
          isSaved: false,
          status: "active",
          expiresAt: newExpiryDate 
      });

      if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);
      
      return res.json({ 
          success: true, 
          message: "Post unpinned. It will be deleted in 24 hours.",
          expiresAt: newExpiryDate 
      });

    } else {
      await post.update({ 
          isSaved: true,
          status: "active",
          expiresAt: null 
      });

      if (redisClient?.isReady) await redisClient.del(`userPosts:${userId}`);

      return res.json({ 
          success: true, 
          message: "Post pinned to profile successfully." 
      });
    }

  } catch (error) {
    console.error("TOGGLE PIN ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle pin status" });
  }
};

// ==========================================
//  INCREMENT VIDEO VIEW COUNT
// ==========================================
export const incrementViewCount = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.type === 'video' || post.type === 'audio') {
      await post.increment("viewsCount");

      if (redisClient?.isReady) {
        await redisClient.del(`userPosts:${post.userId}`);
      }
    }

    return res.status(200).json({ success: true, message: "View counted" });
  } catch (error) {
    console.error("🔥 View Increment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to count view" });
  }
};