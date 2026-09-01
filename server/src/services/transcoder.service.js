import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

const transcoderClient = new TranscoderServiceClient();

// 🔥 Yahan se process.env poori tarah hata diya hai taaki galat ID na uthe
const RAW_BUCKET_NAME = 'doodlepad-media-staging';
const HLS_BUCKET_NAME = 'doodlepad-media-staging';
const projectId = 'project-7531567b-e7c3-4c4e-8fe'; // 👈 STRICTLY BINA '4' KE
const location = 'asia-south1';
const HLS_BASE_URL = 'http://34.160.65.14';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function validateInputs(rawFileName, postUniqueId, orientation) {
  if (!rawFileName || typeof rawFileName !== 'string' || rawFileName.trim() === '') {
    throw new Error('Invalid rawFileName');
  }
  if (!postUniqueId || !/^[a-zA-Z0-9_-]{10,}$/.test(postUniqueId)) {
    throw new Error('Invalid postUniqueId');
  }
  if (!['portrait', 'landscape'].includes(orientation)) {
    throw new Error('Invalid orientation');
  }
}

export async function startHlsConversion(rawFileName, postUniqueId, orientation = 'portrait', retries = 3) {
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
          inputs: [{ key: 'input0', uri: inputUri }],
          editList: [{ key: 'atom0', inputs: ['input0'], startTimeOffset: { seconds: 0, nanos: 0 } }],
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
                  gopDuration: { seconds: 2, nanos: 0 },
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
            // 🔥 FIX 1: Sirf Video Mux Stream
            {
              key: 'hls-video',
              container: 'fmp4',
              elementaryStreams: ['video-stream0'], // ONLY VIDEO
              segmentSettings: {
                segmentDuration: { seconds: 2, nanos: 0 }
              }
            },
            // 🔥 FIX 2: Sirf Audio Mux Stream (fMP4 me alag rakhna zaruri hai)
            {
              key: 'hls-audio',
              container: 'fmp4',
              elementaryStreams: ['audio-stream0'], // ONLY AUDIO
              segmentSettings: {
                segmentDuration: { seconds: 2, nanos: 0 }
              }
            }
          ],
          manifests: [
            {
              fileName: 'master.m3u8',
              type: 'HLS',
              // 🔥 FIX 3: Manifest ko dono stream (audio aur video) link karni hongi
              muxStreams: ['hls-video', 'hls-audio']
            }
          ]
        }
      };

      console.log(`🚀 [Attempt ${attempt}/${retries}] Transcoding ${rawFileName} (${orientation}) → 2-sec fMP4 HLS segments...`);
      
      const [response] = await transcoderClient.createJob({ parent, job });
      
      console.log(`✅ GCP Transcoder Job Queued`);
      console.log(`📊 Output Format: fMP4-based HLS (Video & Audio Chunked Separately)`);
      
      const finalHlsUrl = `${HLS_BASE_URL}/post_videos_hls/${postUniqueId}/master.m3u8`;
      console.log(`📹 Stream URL: ${finalHlsUrl}`);
      
      return finalHlsUrl;

    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} Failed: ${error.message}`);
      
      if (attempt < retries) {
        const delay = attempt * 2000;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error('❌ All retry attempts exhausted');
        return null;
      }
    }
  }
}