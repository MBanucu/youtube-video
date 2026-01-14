import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { concatMts } from '@/concat-mts'

test.concurrent(
  'concatMts - concatenates MTS files from testdata',
  async () => {
    const sourceDir = './testdata'
    const outputDir = './tmp/concat'
    const outputFileName = 'concatenated.MTS'

    // Clean up any existing output dir
    if (existsSync(outputDir))
      rmSync(outputDir, { recursive: true, force: true })

    // Ensure output dir exists
    mkdirSync(outputDir, { recursive: true })

    // Run concat
    await concatMts({
      sourceDir,
      outputDir,
      outputFileName,
    })

    // Check that output file was created
    const outputPath = resolve(join(outputDir, outputFileName))
    expect(
      existsSync(outputPath),
      `Expected output file at ${outputPath}`,
    ).toBe(true)

    // Check that concat-filelist.txt was created
    const filelistPath = resolve(join(outputDir, 'concat-filelist.txt'))
    expect(
      existsSync(filelistPath),
      `Expected concat-filelist.txt at ${filelistPath}`,
    ).toBe(true)

    // Clean up
    rmSync(outputDir, { recursive: true, force: true })
  },
  { timeout: 60000 },
) // Longer timeout for ffmpeg
