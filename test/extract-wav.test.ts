import { expect, test } from 'bun:test'
import { existsSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import tmp from 'tmp'
import { extractWavFromVideo } from '@/extract-wav'

test('extractWavFromVideo - extracts wav from MTS', () => {
  const inputVideo = join('testdata', '01 - before24.MTS')
  // Create a unique temp directory
  const tmpDir = tmp.dirSync({
    prefix: 'youtube-video-test-',
    unsafeCleanup: true,
  })
  const outputWav = join(tmpDir.name, 'out.wav')

  // Clean up output if present
  if (existsSync(outputWav)) unlinkSync(outputWav)

  // Test extraction
  const result = extractWavFromVideo(inputVideo, outputWav)
  expect(result).toBe(true)
  expect(existsSync(outputWav)).toBe(true)
  expect(statSync(outputWav).size).toBeGreaterThan(1000)

  // Clean up after test
  unlinkSync(outputWav)
})
