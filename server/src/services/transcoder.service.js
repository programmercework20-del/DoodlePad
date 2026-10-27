import { TranscoderServiceClient } from '@google-cloud/video-transcoder';

const transcoderClient = new TranscoderServiceClient();

const RAW_BUCKET_NAME = 'doodlepad-media-staging';
const HLS_BUCKET_NAME = 'doodlepad-media-staging';
const projectId = 'project-7531567b-e7c3-4c4e-8fe'; 
const location = 'asia-south1';
const HLS_BASE_URL = 'http://34.160.65.14';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function validateInputs(rawFileName, postUniqueId, orientation, fileType) {
  if (!rawFileName || typeof rawFileName !== 'string' || rawFileName.trim() === '') {
    throw new Error('Invalid rawFileName');
  }
  if (!postUniqueId || !/^[a-zA-Z0-9_-]{10,}$/.test(postUniqueId)) {
    throw new Error('Invalid postUniqueId');
  }
  if (fileType === 'video' && !['portrait', 'landscape'].includes(orientation)) {
    throw new Error(`Invalid orientation for video: ${orientation}`);
  }
}

// 🔥 Added `dimensions` parameter for exact aspect-ratio preservation from ffprobe
export async function startHlsConversion(
  rawFileName,
  postUniqueId,
  orientation = 'portrait',
  retries = 3,
  fileType = 'video',
  dimensions = null
) {
  const normalizedOrientation = typeof orientation === 'string' ? orientation.toLowerCase().trim() : 'portrait';

  try {
    validateInputs(rawFileName, postUniqueId, normalizedOrientation, fileType);
  } catch (error) {
    console.error('❌ Validation Error:', error.message);
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const parent = transcoderClient.locationPath(projectId, location);
      const inputUri = `gs://${RAW_BUCKET_NAME}/${rawFileName}`;
      
      const folderPrefix = fileType === 'audio' ? 'post_audios_hls' : 'post_videos_hls';
      const outputUri = `gs://${HLS_BUCKET_NAME}/${folderPrefix}/${postUniqueId}/`;

      const isPortrait = normalizedOrientation === 'portrait';

      // =====================================
      // 🛠️ JOB CONFIGURATION LOGIC
      // =====================================
      const audioStreamConfig = {
        key: 'audio-stream0',
        audioStream: { codec: 'aac', bitrateBps: 128000, channelCount: 2, sampleRateHertz: 44100 }
      };

      const audioMuxStream = {
        key: 'hls-audio',
        container: 'fmp4',
        elementaryStreams: ['audio-stream0'],
        segmentSettings: { segmentDuration: { seconds: 2, nanos: 0 } }
      };

      let elementaryStreams = [audioStreamConfig];
      let muxStreams = [audioMuxStream];
      let manifestMuxStreams = ['hls-audio'];

      if (fileType === 'video') {
        // 🔥 Use exact ffprobe-calculated even dimensions if available; otherwise auto-scale by single axis
        let dimensionConfig;
        if (dimensions && dimensions.widthPixels && dimensions.heightPixels) {
          dimensionConfig = {
            widthPixels: dimensions.widthPixels,
            heightPixels: dimensions.heightPixels
          };
        } else {
          dimensionConfig = isPortrait ? { widthPixels: 720 } : { heightPixels: 720 };
        }

        const videoStreamConfig = {
          key: 'video-stream0',
          videoStream: {
            h264: {
              ...dimensionConfig,
              bitrateBps: 2500000,
              frameRate: 30,
              allowOpenGop: false,
              gopDuration: { seconds: 1, nanos: 0 },
              vbvSizeBits: 2500000,
              vbvFullnessBits: 2250000,
              entropyCoder: 'cabac',
              bPyramid: false,
              bFrameCount: 3,
              aqStrength: 1,
              profile: 'high',
            }
          }
        };

        const videoMuxStream = {
          key: 'hls-video',
          container: 'fmp4',
          elementaryStreams: ['video-stream0'],
          segmentSettings: { segmentDuration: { seconds: 2, nanos: 0 } }
        };

        elementaryStreams.unshift(videoStreamConfig);
        muxStreams.unshift(videoMuxStream);
        manifestMuxStreams.push('hls-video');
      }

      const job = {
        inputUri,
        outputUri,
        config: {
          inputs: [{ key: 'input0', uri: inputUri }],
          editList: [{ key: 'atom0', inputs: ['input0'], startTimeOffset: { seconds: 0, nanos: 0 } }],
          elementaryStreams: elementaryStreams,
          muxStreams: muxStreams,
          manifests: [
            { fileName: 'master.m3u8', type: 'HLS', muxStreams: manifestMuxStreams }
          ]
        }
      };

      console.log(
        `🚀 [Attempt ${attempt}/${retries}] Transcoding ${fileType.toUpperCase()} (${normalizedOrientation.toUpperCase()}) ` +
        `${dimensions ? `[${dimensions.widthPixels}x${dimensions.heightPixels}]` : '[Auto-AR]'} ${rawFileName} → 2-sec fMP4 HLS...`
      );
      
      const [response] = await transcoderClient.createJob({ parent, job });
      
      console.log(`✅ GCP Transcoder Job Queued for ${fileType.toUpperCase()} [${normalizedOrientation}]`);
      
      const finalHlsUrl = `${HLS_BASE_URL}/${folderPrefix}/${postUniqueId}/master.m3u8`;
      console.log(`🎵 Stream URL: ${finalHlsUrl}`);
      
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