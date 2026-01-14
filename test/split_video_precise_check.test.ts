import { test, expect } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { splitVideoPrecise } from "../src/split_video_precise";
import { splitVideoPreciseCheck } from "../src/split_video_precise_check";

test("splitVideoPreciseCheck - verifies split parts match original duration", async () => {
  const srcFile = join("testdata", "01 - before24.MTS");
  const outputDir = join("tmp", "check-split");
  const parts = 2;

  // Clean up any existing output dir
  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });

  // Ensure output dir exists
  mkdirSync(outputDir, { recursive: true });

  // Split the video
  await splitVideoPrecise({
    srcFile,
    outputDir,
    parts,
  });

  // Now check the durations
  const passed = await splitVideoPreciseCheck({
    srcFile,
    videosDir: outputDir,
    threshold: 0.2, // Allow larger difference due to splitting precision
  });

  // Assert that the check passed
  expect(passed).toBe(true);

  // Clean up
  rmSync(outputDir, { recursive: true, force: true });
}, { timeout: 180000 }); // Allow time for splitting and checking