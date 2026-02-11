import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

// 🔥 tell fluent-ffmpeg where binaries are
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

export const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.log("FFPROBE ERROR:", err);
        return reject(err);
      }

      const duration = metadata.format.duration; // seconds
      resolve(duration);
    });
  });
};
