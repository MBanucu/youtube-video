import { spawnSync } from 'node:child_process'

/**
 * Extracts WAV audio from a video file using ffmpeg.
 * @param inputVideo Path to the input video file
 * @param outputWav Desired output .wav file path
 * @param options Configuration options
 * @returns true if successful, false if ffmpeg fails
 */
export function extractWavFromVideo(
  inputVideo: string,
  outputWav: string,
  options: { loglevel?: string } = {},
): boolean {
  console.log(`Converting ${inputVideo} → ${outputWav}`)
  const loglevel = options.loglevel || 'error'
  const conv = spawnSync(
    'ffmpeg',
    [
      '-loglevel',
      loglevel,
      '-i',
      inputVideo,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      outputWav,
    ],
    { stdio: 'inherit' },
  )
  if (conv.status !== 0) {
    console.error(`ffmpeg failed for ${inputVideo}!`)
    return false
  }
  return true
}
