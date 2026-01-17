import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { generateDescriptionsFromPaths } from '@/generate-description'
import { paths } from '@/paths'
import { logger } from './logging'

// Logger is imported from logging.ts

/**
 * Batch generates descriptions for all txt files in the trans directory.
 * @param options Configuration options
 */
export async function batchGenerateDescriptions(
  options: { transDir?: string; descriptionsDir?: string } = {},
) {
  const transDir = options.transDir || paths.transDir
  const outDir = options.descriptionsDir || paths.descriptionsDir

  // Ensure output folder exists
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const srtFiles = readdirSync(transDir)
    .filter((f) => f.endsWith('.srt'))
    .sort()

  const jobs: Promise<void>[] = []
  let delay = 0

  for (const srt of srtFiles) {
    const srtPath = join(transDir, srt)
    const base = basename(srt, '.srt')
    const outputFile = join(outDir, `${base}-description.txt`)

    for (const language of ['en', 'de'] as const) {
      // Output file path per language
      const langFileSuffix = language === 'en' ? '_en.txt' : '_de.txt'
      const finalOutFile = outputFile.slice(0, -4) + langFileSuffix
      if (existsSync(finalOutFile)) {
        logger.info(
          { srtPath, language, finalOutFile },
          'Skipping: already exists',
        )
        continue
      }
      // Launch each job with delay
      const job = ((delayMs, srtPath) => async () => {
        await new Promise((res) => setTimeout(res, delayMs))
        logger.info(
          { language: language.toUpperCase(), srtPath, delayMs },
          'Starting description generation',
        )
        try {
          await generateDescriptionsFromPaths(srtPath, outputFile, language)
        } catch (err) {
          logger.error({ srtPath, language, error: err }, 'Generation failed')
        }
      })(delay, srtPath)
      jobs.push(job())
      delay += 1000 // 1s between starts
    }
  }

  await Promise.all(jobs)
  logger.info('All jobs complete.')
}

if (import.meta.main) {
  ;(async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import('yargs')
    const yargs = yargsMod.default
    const argv = await yargs(process.argv.slice(2))
      .usage('Usage: $0 [options]')
      .option('trans-dir', {
        describe: 'Directory containing TXT transcript files',
        type: 'string',
      })
      .option('descriptions-dir', {
        describe: 'Directory for description output files',
        type: 'string',
      })
      .help().argv
    await batchGenerateDescriptions({
      transDir: argv['trans-dir'],
      descriptionsDir: argv['descriptions-dir'],
    })
  })()
}
