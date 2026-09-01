import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

const transcoderClient = new TranscoderServiceClient();
const RAW_BUCKET_NAME = 'doodlepad-media-staging';
const HLS_BUCKET_NAME = 'doodlepad-media-staging';
const projectId = 'project-7531567b-e7c3-4c4e-8fe';
const location = 'asia-south1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function startHlsConversion(rawFileName, postUniqueId, orientation = 'portrait', retries = 3) {
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
          // 🔥 inputs/editList hatao — simple mode better kaam karta hai GCP mein
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
                  // 🔥 FIX 1: gopFrameCount = 30fps * 2sec = 60
                  // Yeh har 2 second pe I-frame force karega
                  gopFrameCount: 60,
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
              // 🔥 FIX 2: fileName BILKUL MAT LIKHO
              // GCP khud chunks banayega segment_XXXXX.ts format mein
              container: 'ts',
              elementaryStreams: ['video-stream0', 'audio-stream0'],
              segmentSettings: {
                // 🔥 FIX 3: Exact Duration object format
                segmentDuration: { 
                  seconds: 2,
                  nanos: 0  // 🔥 nanos field zaruri hai GCP gRPC mein
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

      console.log(`🚀 [Attempt ${attempt}] Starting GCP Transcoder for ${rawFileName} (${orientation})...`);
      const [response] = await transcoderClient.createJob({ parent, job });
      
      const finalHlsUrl = `http://34.160.65.14/post_videos_hls/${postUniqueId}/master.m3u8`;
      console.log(`✅ HLS Job created! URL: ${finalHlsUrl}`);

      return finalHlsUrl;

    } catch (error) {
      console.error(`❌ Transcoder Error (Attempt ${attempt}/${retries}):`, error.message);
      
      if (attempt < retries) {
        const delay = attempt * 2000; // 2s, 4s backoff
        console.log(`⏳ Retrying in ${delay/1000}s...`);
        await sleep(delay);
      } else {
        console.error("❌ All retries failed");
        return null;
      }
    }
  }
}