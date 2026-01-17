import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { logger } from './logging'

// Logger is imported from logging.ts

/**
 * Runs the Python transcribe script for the given audio file, writes output.
 * Prints to stdout/stderr, resolves to the exit code.
 */
export function runTranscribe(
  audioPath: string,
  outputPath: string,
  model: string = 'small',
  language: string = 'de',
): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('python3', [
      join('python', 'transcribe.py'),
      audioPath,
      '--model',
      model,
      '--language',
      language,
      '--output',
      outputPath,
    ])
    proc.stdout.on('data', (data) => process.stdout.write(data))
    proc.stderr.on('data', (data) => process.stderr.write(data))
    proc.on('close', (code) => {
      if (code === 0) {
        logger.info(
          { outputPath },
          'Transcription finished, output in %s',
          outputPath,
        )
      } else {
        logger.error({ code }, 'Transcription failed with exit code %d', code)
      }
      resolve(code ?? 1)
    })
  })
}

if (import.meta.main) {
  ;(async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import('yargs')
    const yargs = yargsMod.default
    const argv = await yargs(process.argv.slice(2))
      .usage('Usage: $0 --audio <input.wav> --output <output.srt> [options]')
      .option('audio', {
        alias: 'a',
        describe: 'Path to input audio file',
        type: 'string',
        demandOption: true,
      })
      .option('output', {
        alias: 'o',
        describe: 'Output SRT file path',
        type: 'string',
        demandOption: true,
      })
      .option('model', {
        describe: 'Model size for transcription',
        type: 'string',
        default: 'small',
      })
      .option('language', {
        alias: 'l',
        describe: 'Language code (e.g., de, en)',
        type: 'string',
        default: 'de',
      })
      .help().argv
    await runTranscribe(argv.audio, argv.output, argv.model, argv.language)
  })()
}
