import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

const transcoderClient = new TranscoderServiceClient();

// Tumhara exact purana raw bucket
const RAW_BUCKET_NAME = 'doodlepad-media-staging'; 

// Humara naya HLS bucket
const HLS_BUCKET_NAME = 'doodlepad-hls-output'; 

// URL se nikala hua exact Project ID
const projectId = 'project-7531567b-e7c3-4c4e-8fe'; 

// Tumhara Mumbai Region
const location = 'asia-south1'; 

export async function startHlsConversion(rawFileName, postUniqueId) {
  try {
    const parent = transcoderClient.locationPath(projectId, location);
    
    // Yahan file MP4 me aayegi aur HLS (m3u8/ts) me bahar niklegi
    const inputUri = `gs://${RAW_BUCKET_NAME}/${rawFileName}`;
    const outputUri = `gs://${HLS_BUCKET_NAME}/post_videos_hls/${postUniqueId}/`;

    const job = {
      inputUri: inputUri,
      outputUri: outputUri,
      config: {
        elementaryStreams: [
          { key: 'video-stream0', videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2000000, frameRate: 30 } } },
          { key: 'audio-stream0', audioStream: { codec: 'aac', bitrateBps: 128000 } }
        ],
        muxStreams: [
          { key: 'hls-video', container: 'ts', elementaryStreams: ['video-stream0', 'audio-stream0'] }
        ],
        manifests: [
          { fileName: 'master.m3u8', type: 'HLS', muxStreams: ['hls-video'] }
        ]
      }
    };

    console.log(`🚀 Starting GCP Transcoder Job for ${rawFileName}...`);
    const [response] = await transcoderClient.createJob({ parent, job });
    console.log(`✅ HLS Job created successfully! Output will be at: ${outputUri}master.m3u8`);
    
    // Frontend ko dene ke liye naya HLS CDN link return kar rahe hain
    return `http://34.160.65.14/post_videos_hls/${postUniqueId}/master.m3u8`;
    
  } catch (error) {
    console.error("❌ Transcoder Error:", error);
    return null;
  }
}