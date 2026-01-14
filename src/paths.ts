import { join } from 'node:path'

const sourceDir = process.cwd()

export const paths = {
  rootConcatDir: join(sourceDir, 'youtube-video-concat'),
  videosDir: join(sourceDir, 'youtube-video-concat', 'split', 'videos'),
  audiosDir: join(sourceDir, 'youtube-video-concat', 'split', 'audios'),
  transDir: join(sourceDir, 'youtube-video-concat', 'split', 'transcriptions'),
  descriptionsDir: join(
    sourceDir,
    'youtube-video-concat',
    'split',
    'descriptions',
  ),
}
