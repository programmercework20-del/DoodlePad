import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

const transcoderClient = new TranscoderServiceClient();
const RAW_BUCKET_NAME = 'doodlepad-media-staging';
const HLS_BUCKET_NAME = 'doodlepad-media-staging';
const projectId = 'project-7531567b-e7c3-4c4e-8fe';
const location = 'asia-south1';

export async function startHlsConversion(rawFileName, postUniqueId, orientation = 'portrait') {
  try {
    const parent = transcoderClient.locationPath(projectId, location);
    
    const inputUri = `gs://${RAW_BUCKET_NAME}/${rawFileName}`;
    const outputUri = `gs://${HLS_BUCKET_NAME}/post_videos_hls/${postUniqueId}/`;

    // 🔥 Orientation ke basis pe dimensions set karo
    const isPortrait = orientation === 'portrait';
    const videoWidth = isPortrait ? 720 : 1280;
    const videoHeight = isPortrait ? 1280 : 720;

    const job = {
      inputUri,
      outputUri,
      config: {
        inputs: [{ key: 'input0', uri: inputUri }],
        editList: [{ key: 'atom0', inputs: ['input0'], startTimeOffset: { seconds: 0 } }], 
      
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
                gopDuration: { seconds: 2 }, // ✅ FIX 1: Changed to object
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
            container: 'ts',
            elementaryStreams: ['video-stream0', 'audio-stream0'],
            segmentSettings: {
               segmentDuration: { seconds: 2 } // ✅ Checked: This is correct
              },
          }
        ],
        manifests: [
          {
            fileName: 'master.m3u8',
            type: 'HLS',
            muxStreams: ['hls-video']
          }
        ],
        overlays: []
      }
    };

    console.log(`🚀 Starting GCP Transcoder Job for ${rawFileName} (${orientation})...`);
    const [response] = await transcoderClient.createJob({ parent, job });
    
    const finalHlsUrl = `http://34.160.65.14/post_videos_hls/${postUniqueId}/master.m3u8`;
    console.log(`✅ HLS Job created! Output: ${finalHlsUrl}`);

    // ✅ FIX 2: Sirf string return kar rahe hain taaki DB break na ho
    return finalHlsUrl;

  } catch (error) {
    console.error("❌ Transcoder Error:", error);
    return null;
  }
}