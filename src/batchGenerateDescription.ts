import { spawnSync } from "child_process";
import { readdirSync, existsSync } from "fs";
import { join, basename } from "path";

const splitDir = "youtube-video-concat/split";
const outDir = "youtube-video-concat/split/descriptions";

const txtFiles = readdirSync(splitDir)
  .filter(f => f.endsWith(".txt") && !f.endsWith("-description.txt"))
  .sort();

for (const txt of txtFiles) {
  const inputFile = join(splitDir, txt);
  const base = basename(txt, ".txt");
  const outputFile = join(outDir, `${base}-description.txt`);

  // Skip if output already exists
  if (existsSync(outputFile)) {
    console.log(`Skipping ${inputFile}: ${outputFile} already exists.`);
    continue;
  }

  console.log(`Generating description for ${inputFile} -> ${outputFile} ...`);
  const proc = spawnSync("bun", [
    "run",
    "src/generate-description.ts",
    "--input", inputFile,
    "--output", outputFile
  ], { stdio: "inherit" });

  if (proc.status !== 0) {
    console.error(`FAILED for ${inputFile}`);
  }
}
