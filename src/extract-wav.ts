import { spawnSync } from 'node:child_process'

import { logger } from './logging'

// Logger is imported from logging.ts

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
  logger.info({ inputVideo, outputWav }, 'Converting video to WAV')
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
    logger.error({ inputVideo }, 'ffmpeg conversion failed')
    return false
  }
  return true
}
