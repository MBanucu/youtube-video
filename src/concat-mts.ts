import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { paths } from '@/paths'
import { ffprobeDuration } from '@/utils'
import { loggers } from './logging'

// Logger is imported from logging.ts

/**
 * Concatenates multiple MTS video files into a single output file using ffmpeg.
 * @param options Configuration options
 */
export async function concatMts(
  options: {
    sourceDir?: string
    outputDir?: string
    outputFileName?: string
    fileListName?: string
    loglevel?: string
  } = {},
) {
  const sourceDir = options.sourceDir || join(process.cwd(), 'concat_src')
  const destDir = options.outputDir || paths.rootConcatDir
  const outputFileName = options.outputFileName || 'all_in_one.MTS'
  const fileListName = options.fileListName || 'concat-filelist.txt'
  const loglevel = options.loglevel || 'error'
  const outputFile = join(destDir, outputFileName)
  const myListPath = join(destDir, fileListName)

  // List all .MTS files in sourceDir
  const files = (await readdir(sourceDir))
    .filter((f) => f.endsWith('.MTS'))
    .sort()

  // Prepare mylist.txt content
  const listContent = `${files.map((f) => `file '${resolve(join(sourceDir, f))}'`).join('\n')}\n`
  await writeFile(myListPath, listContent)
  loggers.videoConcat.info(
    { fileListName },
    'File list written: %s',
    fileListName,
  )

  // Ensure output destination exists
  await mkdir(destDir, { recursive: true })

  // Run ffmpeg command
  const ffmpegCmd = [
    'ffmpeg',
    '-loglevel',
    loglevel,
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    myListPath,
    '-c',
    'copy',
    outputFile,
  ]
  loggers.videoConcat.info(
    { command: ffmpegCmd.join(' ') },
    'Running: %s',
    ffmpegCmd.join(' '),
  )
  const proc = Bun.spawn(ffmpegCmd, {
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`ffmpeg failed with code ${code}`)
  } else {
    loggers.videoConcat.info(
      { outputFile },
      'Concatenation successful: %s',
      outputFile,
    )
  }

  // ---- Duration check ----
  loggers.videoConcat.info('Checking durations...')
  let sum = 0
  for (const f of files) {
    const fpath = join(sourceDir, f)
    const dur = await ffprobeDuration(fpath)
    sum += dur
    loggers.videoConcat.info(
      { file: f, duration: dur },
      'Duration for %s: %.3fs',
      f,
      dur,
    )
  }
  const outDur = await ffprobeDuration(outputFile)
  const diff = sum - outDur
  loggers.videoConcat.info(
    { sum, outDur, diff },
    'Sum of input durations: %.3fs, Output duration: %.3fs, Difference: %.5fs',
    sum,
    outDur,
    diff,
  )
  if (diff > 0.01) {
    loggers.videoConcat.warn(
      { diff },
      'WARNING: Measurable duration difference detected! Difference: %.5fs',
      diff,
    )
  } else {
    loggers.videoConcat.info('Durations match.')
  }
}

if (import.meta.main) {
  ;(async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import('yargs')
    const yargs = yargsMod.default
    const argv = await yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .option('source-dir', {
        describe: 'Directory containing MTS files to concatenate',
        type: 'string',
      })
      .option('output-dir', {
        describe: 'Directory for output file',
        type: 'string',
      })
      .option('output-file-name', {
        describe: 'Name of the output MTS file',
        type: 'string',
      })
      .option('file-list-name', {
        describe: 'Name of the file list for ffmpeg concat',
        type: 'string',
      })
      .option('loglevel', {
        describe:
          'FFmpeg log level (quiet, panic, fatal, error, warning, info, verbose, debug, trace)',
        type: 'string',
        default: 'error',
      })
      .help().argv
    await concatMts({
      sourceDir: argv['source-dir'],
      outputDir: argv['output-dir'],
      outputFileName: argv['output-file-name'],
      fileListName: argv['file-list-name'],
      loglevel: argv.loglevel,
    })
  })().catch((err: unknown) => {
    loggers.videoConcat.error({ error: err }, 'Error: %s', err)
    process.exit(1)
  })
}
