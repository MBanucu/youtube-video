import { test, expect } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

// Mock the generateDescriptionsFromPaths function
import { mock } from "bun:test";

mock.module("./generate-description", () => ({
  generateDescriptionsFromPaths: mock(async (input: string, output: string, lang: string) => {
    // Mock implementation: write mock files
    const fs = await import("fs");
    const outPath = lang === 'en' ? output.replace('.txt', '_en.txt') : output.replace('.txt', '_de.txt');
    fs.writeFileSync(outPath, `Mock description for ${lang} from SRT`);
  }),
}));

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
  expect(existsSync(join(tmpDescDir, "test-description_en.txt"))).toBe(true);
  expect(existsSync(join(tmpDescDir, "test-description_de.txt"))).toBe(true);

  // Check content (mocked)
  const enContent = await Bun.file(join(tmpDescDir, "test-description_en.txt")).text();
  expect(enContent).toBe("Mock description for en from SRT");

  const deContent = await Bun.file(join(tmpDescDir, "test-description_de.txt")).text();
  expect(deContent).toBe("Mock description for de from SRT");

  // Clean up
  rmSync(tmpTransDir, { recursive: true, force: true });
  rmSync(tmpDescDir, { recursive: true, force: true });
}, { timeout: 10000 });