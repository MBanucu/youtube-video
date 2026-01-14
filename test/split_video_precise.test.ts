import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { splitVideoPrecise } from '@/split_video_precise'

test(
  'splitVideoPrecise - splits MTS file into parts',
  async () => {
    const srcFile = join('testdata', '01 - before24.MTS')
    const outputDir = join('tmp', 'split')
    const parts = 2

    // Clean up any existing output dir
    if (existsSync(outputDir))
      rmSync(outputDir, { recursive: true, force: true })

    // Ensure output dir exists
    mkdirSync(outputDir, { recursive: true })

    // Run split
    await splitVideoPrecise({
      srcFile,
      outputDir,
      parts,
    })

    // Check that output files were created
    for (let i = 1; i <= parts; i++) {
      const partPath = resolve(join(outputDir, `part${i}.MTS`))
      expect(existsSync(partPath), `Expected part${i}.MTS at ${partPath}`).toBe(
        true,
      )
    }

    // Clean up
    rmSync(outputDir, { recursive: true, force: true })
  },
  { timeout: 120000 },
) // Allow time for splitting
