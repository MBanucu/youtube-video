import { test, expect } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join, resolve } from "path";

// Import the functions
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
  const enPath = resolve(join(tmpDescDir, "test-description_en.txt"));
  const dePath = resolve(join(tmpDescDir, "test-description_de.txt"));
  expect(existsSync(enPath), `Expected EN description file at ${enPath}`).toBe(true);
  expect(existsSync(dePath), `Expected DE description file at ${dePath}`).toBe(true);

  // Check content (real AI-generated)
  const enContent = await Bun.file(join(tmpDescDir, "test-description_en.txt")).text();
  expect(enContent.length).toBeGreaterThan(50); // Substantial content
  expect(enContent.toLowerCase()).toContain("dryer"); // Content from SRT

  const deContent = await Bun.file(join(tmpDescDir, "test-description_de.txt")).text();
  expect(deContent.length).toBeGreaterThan(50);
  expect(deContent.toLowerCase()).toContain("trockner");

  // Clean up
  rmSync(tmpTransDir, { recursive: true, force: true });
  rmSync(tmpDescDir, { recursive: true, force: true });
}, { timeout: 30000 });