import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractWavFromVideo } from '@/extract-wav'
import { runTranscribe } from '@/runTranscribe'

// Test function extracted for reuse
const runTranscribeTestFn = async () => {
  const inputVideo = join('testdata', '01 - before24.MTS')
  const tmpDir = mkdtempSync(join(tmpdir(), 'runTranscribe-test-'))
  const wavPath = join(tmpDir, 'input.wav')
  const srtPath = join(tmpDir, 'output.srt')

  // Extract wav
  const wrok = extractWavFromVideo(inputVideo, wavPath)
  expect(wrok).toBe(true)
  expect(existsSync(wavPath)).toBe(true)
  expect(statSync(wavPath).size).toBeGreaterThan(1000)

  // Remove output if present
  if (existsSync(srtPath)) unlinkSync(srtPath)

  // Transcribe
  const exitCode = await runTranscribe(wavPath, srtPath)
  expect(exitCode).toBe(0)
  expect(existsSync(srtPath)).toBe(true)
  expect(statSync(srtPath).size).toBeGreaterThan(20) // SRT file is not empty

  // Read and check SRT text
  const srtRaw = await Bun.file(srtPath).text()
  const lines = srtRaw.split('\n')
  const textLines = lines.filter(
    (line) =>
      line.trim() && !line.includes('-->') && !/^\d+$/.test(line.trim()),
  )
  const srtText = textLines.map((line) => line.trim()).join(' ')
  expect(srtText.length).toBeGreaterThan(100) // Ensure substantial text
  expect(srtText.toLowerCase()).toContain('hallo und herzlich willkommen')
  expect(srtText.toLowerCase()).toContain('testvideo')
  expect(srtText.toLowerCase()).toContain('transkription')

  // Clean up
  unlinkSync(wavPath)
  unlinkSync(srtPath)
  rmSync(tmpDir, { recursive: true, force: true })
}

// biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
if (process.env['CI']) {
  test.concurrent(
    'runTranscribe - transcribes wav to srt',
    runTranscribeTestFn,
    { timeout: 300000 },
  )
} else {
  test.skip('runTranscribe - skipped on local CPU', () => {})
}
