import { test, expect } from "bun:test";
import { batchTranscribe } from "./batchTranscribe";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";

test.concurrent("batchTranscribe - processes MTS files to SRT", async () => {
  const tmpAudioDir = "./tmp/audio";
  const tmpTransDir = "./tmp/trans";

  // Clean up any existing tmp dirs
  if (existsSync(tmpAudioDir)) rmSync(tmpAudioDir, { recursive: true, force: true });
  if (existsSync(tmpTransDir)) rmSync(tmpTransDir, { recursive: true, force: true });

  // Ensure tmp dirs exist
  mkdirSync(tmpAudioDir, { recursive: true });
  mkdirSync(tmpTransDir, { recursive: true });

  // Run batch transcribe
  await batchTranscribe({
    videosDir: "testdata",
    audiosDir: tmpAudioDir,
    transDir: tmpTransDir,
    model: "small",
    language: "de"
  });

  // Check that WAV files were created
  expect(existsSync(join(tmpAudioDir, "before24.wav"))).toBe(true);
  expect(existsSync(join(tmpAudioDir, "after24.wav"))).toBe(true);

  // Check that SRT files were created
  expect(existsSync(join(tmpTransDir, "before24.srt"))).toBe(true);
  expect(existsSync(join(tmpTransDir, "after24.srt"))).toBe(true);

  // Check SRT content (basic check)
  const srtContent = await Bun.file(join(tmpTransDir, "before24.srt")).text();
  expect(srtContent.length).toBeGreaterThan(100);
  expect(srtContent.includes("00:00:00,000 -->")).toBe(true);

  // Clean up
  rmSync(tmpAudioDir, { recursive: true, force: true });
  rmSync(tmpTransDir, { recursive: true, force: true });
}, { timeout: 600000 }); // 10 minutes for transcription