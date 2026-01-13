import { test, expect } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

// Import the functions
import { batchGenerateDescriptions, extractTextFromSRT } from "./batchGenerateDescription";

// Test the extractTextFromSRT function
test("extractTextFromSRT - extracts text from SRT content", () => {
  const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello world this is a test.

2
00:00:05,000 --> 00:00:10,000
Another line of text here.`;

  const expected = "Hello world this is a test. Another line of text here.";
  const result = extractTextFromSRT(srtContent);
  expect(result).toBe(expected);
});

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
  const enPath = join(tmpDescDir, "test-description_en.txt");
  const dePath = join(tmpDescDir, "test-description_de.txt");
  expect(existsSync(enPath), `Expected EN description file at ${enPath}`).toBe(true);
  expect(existsSync(dePath), `Expected DE description file at ${dePath}`).toBe(true);

  // Check content (mocked)
  const enContent = await Bun.file(join(tmpDescDir, "test-description_en.txt")).text();
  expect(enContent).toBe("Mock description for en from SRT");

  const deContent = await Bun.file(join(tmpDescDir, "test-description_de.txt")).text();
  expect(deContent).toBe("Mock description for de from SRT");

  // Clean up
  rmSync(tmpTransDir, { recursive: true, force: true });
  rmSync(tmpDescDir, { recursive: true, force: true });
}, { timeout: 30000 });