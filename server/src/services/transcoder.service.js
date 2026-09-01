import { TranscoderServiceClient } from '@google-cloud/video-transcoder';
import { Database } from '../models/index.js';

const transcoderClient = new TranscoderServiceClient();

// 🔥 FIX 1: Move all hardcoded values to environment variables
const RAW_BUCKET_NAME = process.env.GCP_RAW_BUCKET || 'doodlepad-media-staging';
const HLS_BUCKET_NAME = process.env.GCP_HLS_BUCKET || 'doodlepad-media-staging';
const projectId = process.env.GCP_PROJECT_ID || 'project-7531567b-e7c3-4c4e-8fe';
const location = process.env.GCP_LOCATION || 'asia-south1';
const HLS_BASE_URL = process.env.HLS_BASE_URL || 'http://34.160.65.14'; // Externalize IP

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🔥 Input validation helper
function validateInputs(rawFileName, postUniqueId, orientation) {
  if (!rawFileName || typeof rawFileName !== 'string' || rawFileName.trim() === '') {
    throw new Error('Invalid rawFileName: must be non-empty string');
  }
  if (!postUniqueId || !/^[a-zA-Z0-9_-]{10,}$/.test(postUniqueId)) {
    throw new Error('Invalid postUniqueId: must be alphanumeric, min 10 chars');
  }
  if (!['portrait', 'landscape'].includes(orientation)) {
    throw new Error('Invalid orientation: must be portrait or landscape');
  }
}

export async function startHlsConversion(rawFileName, postUniqueId, orientation = 'portrait', retries = 3) {
  // 🔥 Input validation
  try {
    validateInputs(rawFileName, postUniqueId, orientation);
  } catch (error) {
    console.error('❌ Validation Error:', error.message);
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const parent = transcoderClient.locationPath(projectId, location);
      
      const inputUri = `gs://${RAW_BUCKET_NAME}/${rawFileName}`;
      const outputUri = `gs://${HLS_BUCKET_NAME}/post_videos_hls/${postUniqueId}/`;

      const isPortrait = orientation === 'portrait';
      const videoWidth = isPortrait ? 720 : 1280;
      const videoHeight = isPortrait ? 1280 : 720;

      const job = {
        inputUri,
        outputUri,
        config: {
          // 🔥 FIX 2: KEEP inputs/editList (required for GCP HLS muxing)
          inputs: [{ key: 'input0', uri: inputUri }],
          editList: [{
            key: 'atom0',
            inputs: ['input0'],
            startTimeOffset: { seconds: 0, nanos: 0 }
          }],

          elementaryStreams: [
            {
              key: 'video-stream0',
              videoStream: {
                h264: {
                  heightPixels: videoHeight,
                  widthPixels: videoWidth,
                  bitrateBps: 2500000,
                  frameRate: 30,
                  allowOpenGop: false,
                  // 🔥 FIX 3: Use gopDuration (NOT gopFrameCount)
                  // This forces I-frame every 2 sec for proper HLS segmentation
                  gopDuration: {
                    seconds: 2,
                    nanos: 0
                  },
                  vbvSizeBits: 2500000,
                  vbvFullnessBits: 2250000,
                  entropyCoder: 'cabac',
                  bPyramid: false,
                  bFrameCount: 3,
                  aqStrength: 1,
                  profile: 'high',
                }
              }
            },
            {
              key: 'audio-stream0',
              audioStream: {
                codec: 'aac',
                bitrateBps: 128000,
                channelCount: 2,
                sampleRateHertz: 44100
              }
            }
          ],
          muxStreams: [
            {
              key: 'hls-video',
              // 🔥 FIX 4: CRITICAL - Correct fileName format for HLS segmentation
              // %05d expands to 00000, 00001, 00002... (5-digit zero-padded numbers)
              fileName: 'segment_%05d.ts',
              container: 'ts',
              elementaryStreams: ['video-stream0', 'audio-stream0'],
              // 🔥 FIX 5: CRITICAL - Proper segmentSettings (THE MAIN FIX)
              // This is what actually triggers 2-second chunking in GCP
              segmentSettings: {
                segmentDuration: {
                  seconds: 2,
                  nanos: 0
                }
              }
            }
          ],
          manifests: [
            {
              fileName: 'master.m3u8',
              type: 'HLS',
              muxStreams: ['hls-video']
            }
          ]
        }
      };

      console.log(`🚀 [Attempt ${attempt}/${retries}] Transcoding ${rawFileName} (${orientation}) → HLS segments...`);
      
      // 🔥 FIX 6: Capture response with jobId for status tracking
      const [response] = await transcoderClient.createJob({ parent, job });
      const jobId = response.name; // e.g., "projects/xxx/locations/asia-south1/jobs/12345"
      
      console.log(`✅ GCP Job Created: ${jobId}`);
      console.log(`📊 Config: 2-second segments, fileName=segment_XXXXX.ts`);
      
      // 🔥 FIX 7: Return both jobId and HLS URL for tracking
      const finalHlsUrl = `${HLS_BASE_URL}/post_videos_hls/${postUniqueId}/master.m3u8`;
      
      // Store job metadata (optional, non-blocking)
      try {
        await Database.models.TranscodingJob?.create({
          jobId,
          postUniqueId,
          status: 'PENDING',
          hlsUrl: finalHlsUrl,
          createdAt: new Date()
        }).catch(() => {});
      } catch (dbError) {
        console.warn('⚠️ Could not store job metadata (non-critical):', dbError.message);
      }
      
      console.log(`📹 Output: ${finalHlsUrl}`);
      return { jobId, hlsUrl: finalHlsUrl, status: 'QUEUED' };

    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      console.error(`❌ Attempt ${attempt}/${retries} Failed: ${errorMsg}`);
      
      if (error.details) {
        console.error('   Details:', error.details);
      }
      
      if (attempt < retries) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error('❌ All retry attempts exhausted');
        return null;
      }
    }
  }
}

// 🔥 NEW: Function to poll GCP job status
export async function getTranscodingStatus(jobId) {
  try {
    const response = await transcoderClient.getJob({ name: jobId });
    return {
      status: response.state,
      progress: response.processingDetails?.jobMessages || [],
      error: response.error ? response.error.message : null
    };
  } catch (error) {
    console.error('❌ Failed to get job status:', error.message);
    return null;
  }
}