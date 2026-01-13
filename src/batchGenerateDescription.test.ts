import { test, expect } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

// Import the function
import { batchGenerateDescriptions } from "./batchGenerateDescription";

test("batchGenerateDescriptions - processes txt files to descriptions", async () => {
  const tmpTransDir = "./tmp/trans";
  const tmpDescDir = "./tmp/desc";

  // Clean up any existing tmp dirs
  if (existsSync(tmpTransDir)) rmSync(tmpTransDir, { recursive: true, force: true });
  if (existsSync(tmpDescDir)) rmSync(tmpDescDir, { recursive: true, force: true });

  // Ensure tmp dirs exist
  mkdirSync(tmpTransDir, { recursive: true });
  mkdirSync(tmpDescDir, { recursive: true });

  // Create mock SRT file (copy from testdata)
  const srtContent = await Bun.file("testdata/part2.srt").text();
  writeFileSync(join(tmpTransDir, "test.srt"), srtContent);

  // Run batch generate descriptions
  await batchGenerateDescriptions({
    transDir: tmpTransDir,
    descriptionsDir: tmpDescDir,
  });

  // Check that description files were created
  expect(existsSync(join(tmpDescDir, "test-description_en.txt"))).toBe(true);
  expect(existsSync(join(tmpDescDir, "test-description_de.txt"))).toBe(true);

  // Check content (mocked)
  const enContent = await Bun.file(join(tmpDescDir, "test-description_en.txt")).text();
  expect(enContent).toContain("Mock description for en");

  const deContent = await Bun.file(join(tmpDescDir, "test-description_de.txt")).text();
  expect(deContent).toContain("Mock description for de");

  // Clean up
  rmSync(tmpTransDir, { recursive: true, force: true });
  rmSync(tmpDescDir, { recursive: true, force: true });
}, { timeout: 10000 });