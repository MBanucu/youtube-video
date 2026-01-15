import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { batchTranscribe } from '@/batchTranscribe'

// Conditional test execution for performance-heavy tests
// biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
const runHeavyTest = process.env['CI'] ? test.concurrent : test.skip

runHeavyTest(
  'batchTranscribe - processes MTS files to SRT',
  async () => {
    const tmpAudioDir = './tmp/audio'
    const tmpTransDir = './tmp/trans'

    // Clean up any existing tmp dirs
    if (existsSync(tmpAudioDir))
      rmSync(tmpAudioDir, { recursive: true, force: true })
    if (existsSync(tmpTransDir))
      rmSync(tmpTransDir, { recursive: true, force: true })

    // Ensure tmp dirs exist
    mkdirSync(tmpAudioDir, { recursive: true })
    mkdirSync(tmpTransDir, { recursive: true })

    // Run batch transcribe
    await batchTranscribe({
      videosDir: 'testdata',
      audiosDir: tmpAudioDir,
      transDir: tmpTransDir,
      model: 'small',
      language: 'de',
    })

    // Check that WAV files were created
    expect(existsSync(join(tmpAudioDir, '01 - before24.wav'))).toBe(true)
    expect(existsSync(join(tmpAudioDir, '02 - after24.wav'))).toBe(true)

    // Check that SRT files were created
    expect(existsSync(join(tmpTransDir, '01 - before24.srt'))).toBe(true)
    expect(existsSync(join(tmpTransDir, '02 - after24.srt'))).toBe(true)

    // Check SRT content (basic check)
    const srtContent = await Bun.file(
      join(tmpTransDir, '01 - before24.srt'),
    ).text()
    expect(srtContent.length).toBeGreaterThan(100)
    expect(srtContent.includes('00:00:00,000 -->')).toBe(true)

    // Clean up
    rmSync(tmpAudioDir, { recursive: true, force: true })
    rmSync(tmpTransDir, { recursive: true, force: true })
  },
  { timeout: 600000 },
) // 10 minutes for transcription
