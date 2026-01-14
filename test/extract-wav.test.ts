import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractWavFromVideo } from '@/extract-wav'

test.concurrent('extractWavFromVideo - extracts wav from MTS', () => {
  const inputVideo = join('testdata', '01 - before24.MTS')
  // Create a unique temp directory
  const tmpDir = mkdtempSync(join(tmpdir(), 'youtube-video-test-'))
  const outputWav = join(tmpDir, 'out.wav')

  // Clean up output if present
  if (existsSync(outputWav)) unlinkSync(outputWav)

  // Test extraction
  const result = extractWavFromVideo(inputVideo, outputWav)
  expect(result).toBe(true)
  expect(existsSync(outputWav)).toBe(true)
  expect(statSync(outputWav).size).toBeGreaterThan(1000)

  // Clean up after test
  unlinkSync(outputWav)
  rmSync(tmpDir, { recursive: true, force: true })
})
