import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { paths } from '@/paths'
import { ffprobeDuration } from '@/utils'

/**
 * Splits a video file into equal-duration parts using ffmpeg.
 * @param options Configuration options
 */
export async function splitVideoPrecise(
  options: {
    srcFile?: string
    outputDir?: string
    parts?: number
    loglevel?: string
  } = {},
) {
  const srcFile = options.srcFile || join(paths.rootConcatDir, 'all_in_one.MTS')
  const outputDir = options.outputDir || paths.videosDir
  const parts = options.parts || 6
  const loglevel = options.loglevel || 'error'

  await mkdir(outputDir, { recursive: true })
  const duration = await ffprobeDuration(srcFile)
  let start = 0
  let remaining = duration

  for (let i = 1; i <= parts; i++) {
    const outFile = join(outputDir, `part${i}.MTS`)
    const remParts = parts - (i - 1)
    const partDuration = remaining / remParts
    const partDurationStr = partDuration.toFixed(3)
    const startStr = start.toFixed(3)

    const ffmpegCmd = [
      'ffmpeg',
      '-loglevel',
      loglevel,
      '-ss',
      startStr,
      '-i',
      srcFile,
      ...(i === parts ? [] : ['-t', partDurationStr]),
      '-c',
      'copy',
      outFile,
    ]
    console.log(`Splitting part${i}: ffmpeg ${ffmpegCmd.join(' ')}`)
    const proc = Bun.spawn(ffmpegCmd, {
      stdio: ['inherit', 'inherit', 'inherit'],
    })
    const code = await proc.exited
    if (code !== 0) {
      throw new Error(`ffmpeg failed for part${i} with code ${code}`)
    }
    const actualDuration = await ffprobeDuration(outFile)
    console.log(`part${i}.MTS: ${actualDuration.toFixed(3)}s`)
    start += actualDuration
    remaining -= actualDuration
  }

  console.log('Splitting complete.')
}

if (import.meta.main) {
  ;(async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import('yargs')
    const yargs = yargsMod.default
    const argv = await yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .option('src-file', {
        describe: 'Path to the source video file to split',
        type: 'string',
      })
      .option('output-dir', {
        describe: 'Directory to output the split parts',
        type: 'string',
      })
      .option('parts', {
        describe: 'Number of parts to split into',
        type: 'number',
      })
      .option('loglevel', {
        describe:
          'FFmpeg log level (quiet, panic, fatal, error, warning, info, verbose, debug, trace)',
        type: 'string',
        default: 'error',
      })
      .help().argv
    await splitVideoPrecise({
      srcFile: argv['src-file'],
      outputDir: argv['output-dir'],
      parts: argv.parts,
      loglevel: argv.loglevel,
    })
  })().catch((err: unknown) => {
    console.error('Error:', err)
    process.exit(1)
  })
}
