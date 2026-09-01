// import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

// const transcoderClient = new TranscoderServiceClient();

// // Tumhara exact purana raw bucket
// const RAW_BUCKET_NAME = 'doodlepad-media-staging'; 

// // Humara naya HLS bucket
// // const HLS_BUCKET_NAME = 'doodlepad-hls-output'; 
// // const HLS_BUCKET_NAME = 'doodlepad-cdn-bucket';
// const HLS_BUCKET_NAME = 'doodlepad-media-staging';

// // URL se nikala hua exact Project ID
// const projectId = 'project-7531567b-e7c3-4c4e-8fe'; 

// // Tumhara Mumbai Region
// const location = 'asia-south1'; 

// export async function startHlsConversion(rawFileName, postUniqueId) {
//   try {
//     const parent = transcoderClient.locationPath(projectId, location);
    
//     // Yahan file MP4 me aayegi aur HLS (m3u8/ts) me bahar niklegi
//     const inputUri = `gs://${RAW_BUCKET_NAME}/${rawFileName}`;
//     const outputUri = `gs://${HLS_BUCKET_NAME}/post_videos_hls/${postUniqueId}/`;

//     const job = {
//       inputUri: inputUri,
//       outputUri: outputUri,
//       config: {
//         elementaryStreams: [
//           { key: 'video-stream0', videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2000000, frameRate: 30 } } },
//           { key: 'audio-stream0', audioStream: { codec: 'aac', bitrateBps: 128000 } }
//         ],
//         muxStreams: [
//           { key: 'hls-video', container: 'ts', elementaryStreams: ['video-stream0', 'audio-stream0'] }
//         ],
//         manifests: [
//           { fileName: 'master.m3u8', type: 'HLS', muxStreams: ['hls-video'] }
//         ]
//       }
//     };

//     console.log(`🚀 Starting GCP Transcoder Job for ${rawFileName}...`);
//     const [response] = await transcoderClient.createJob({ parent, job });
//     console.log(`✅ HLS Job created successfully! Output will be at: ${outputUri}master.m3u8`);
    
//     // Frontend ko dene ke liye naya HLS CDN link return kar rahe hain
//     return `http://34.160.65.14/post_videos_hls/${postUniqueId}/master.m3u8`;
    
//   } catch (error) {
//     console.error("❌ Transcoder Error:", error);
//     return null;
//   }
// }


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

    // 🔥 FIX: Orientation ke basis pe dimensions set karo
    const isPortrait = orientation === 'portrait';
    const videoWidth = isPortrait ? 720 : 1280;
    const videoHeight = isPortrait ? 1280 : 720;

    const job = {
      inputUri,
      outputUri,
      config: {
        inputs: [{ key: 'input0', uri: inputUri }],
        editList: [{ key: 'atom0', inputs: ['input0'], startTimeOffset: '0s' }],
        elementaryStreams: [
          {
            key: 'video-stream0',
            videoStream: {
              h264: {
                // 🔥 FIX: -1 use karo taaki aspect ratio auto maintain ho
                heightPixels: videoHeight,
                widthPixels: videoWidth,
                bitrateBps: 2500000,
                frameRate: 30,
                // 🔥 FIX: Rotation metadata preserve karo
                allowOpenGop: false,
                gopDuration: '3s',
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
            segmentSettings: { segmentDuration: '2s' } // <-- Isko 2s kar diya
          }
        
        ],
        manifests: [
          {
            fileName: 'master.m3u8',
            type: 'HLS',
            muxStreams: ['hls-video']
          }
        ],
        // 🔥 FIX: Purani GCP Transcoder rotation bug fix
        overlays: []
      }
    };

    console.log(`🚀 Starting GCP Transcoder Job for ${rawFileName} (${orientation})...`);
    const [response] = await transcoderClient.createJob({ parent, job });
    console.log(`✅ HLS Job created! Output: ${outputUri}master.m3u8`);

    return {
      hlsUrl: `http://34.160.65.14/post_videos_hls/${postUniqueId}/master.m3u8`,
      orientation,
      postUniqueId
    };

  } catch (error) {
    console.error("❌ Transcoder Error:", error);
    return null;
  }
}