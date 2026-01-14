import { test, expect } from "bun:test";
import { extractWavFromVideo } from "./extract-wav";
import { existsSync, unlinkSync, statSync, rmSync } from "fs";
import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

test.concurrent("extractWavFromVideo - extracts wav from MTS", () => {
  const inputVideo = join("testdata", "01 - before24.MTS");
  // Create a unique temp directory
  const tmpDir = mkdtempSync(join(tmpdir(), "youtube-video-test-"));
  const outputWav = join(tmpDir, "out.wav");

  // Clean up output if present
  if (existsSync(outputWav)) unlinkSync(outputWav);

  // Test extraction
  const result = extractWavFromVideo(inputVideo, outputWav);
  expect(result).toBe(true);
  expect(existsSync(outputWav)).toBe(true);
  expect(statSync(outputWav).size).toBeGreaterThan(1000);

  // Clean up after test
  unlinkSync(outputWav);
  rmSync(tmpDir, { recursive: true, force: true });
});


