import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { paths } from '@/paths'
import { ffprobeDuration } from '@/utils'

/**
 * Checks if the sum of split video part durations matches the original video duration.
 * @param options Configuration options
 */
export async function splitVideoPreciseCheck(
  options: { srcFile?: string; videosDir?: string; threshold?: number } = {},
): Promise<boolean> {
  const srcFile = options.srcFile || join(paths.rootConcatDir, 'all_in_one.MTS')
  const videosDir = options.videosDir || paths.videosDir
  const threshold = options.threshold || 0.01

  const originalDur = await ffprobeDuration(srcFile)
  console.log(`Original: ${originalDur.toFixed(3)}s`)

  // Find all partN.MTS files
  const splitFiles = (await readdir(videosDir))
    .filter((f) => /^part\d+\.MTS$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  let sum = 0
  for (const file of splitFiles) {
    const fp = join(videosDir, file)
    const dur = await ffprobeDuration(fp)
    sum += dur
    console.log(`${file}: ${dur.toFixed(3)}s`)
  }
  console.log(`\nSum of part durations: ${sum.toFixed(3)}s`)
  const diff = sum - originalDur
  console.log(`Difference (sum - original): ${diff.toFixed(5)}s`)
  const passed = Math.abs(diff) < threshold
  if (passed) {
    console.log('Test PASSED: Split videos durations match the original.')
  } else {
    console.warn('Test WARNING: There is a non-trivial difference.')
  }
  return passed
}

if (import.meta.main) {
  ;(async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import('yargs')
    const yargs = yargsMod.default
    const argv = await yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .option('src-file', {
        describe: 'Path to the original video file',
        type: 'string',
      })
      .option('videos-dir', {
        describe: 'Directory containing the split video parts',
        type: 'string',
      })
      .option('threshold', {
        describe: 'Duration difference threshold for pass/fail',
        type: 'number',
      })
      .help().argv
    const passed = await splitVideoPreciseCheck({
      srcFile: argv['src-file'],
      videosDir: argv['videos-dir'],
      threshold: argv.threshold,
    })
    process.exit(passed ? 0 : 1)
  })().catch((err: unknown) => {
    console.error('Error:', err)
    process.exit(1)
  })
}
