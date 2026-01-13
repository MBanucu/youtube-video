import { spawnSync } from "child_process";

/**
 * Extracts WAV audio from a video file using ffmpeg.
 * @param inputVideo Path to the input video file
 * @param outputWav Desired output .wav file path
 * @returns true if successful, false if ffmpeg fails
 */
export function extractWavFromVideo(inputVideo: string, outputWav: string): boolean {
  console.log(`Converting ${inputVideo} → ${outputWav}`);
  const conv = spawnSync(
    "ffmpeg",
    ["-i", inputVideo, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", outputWav],
    { stdio: "inherit" }
  );
  if (conv.status !== 0) {
    console.error(`ffmpeg failed for ${inputVideo}!`);
    return false;
  }
  return true;
}
