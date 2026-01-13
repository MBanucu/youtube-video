import { readdir } from "fs/promises";
import { join } from "path";

const outputDir = join(process.cwd(), "youtube-video-concat");
const splitDir = join(outputDir, "split");
const srcFile = join(outputDir, "all_in_one.MTS");
const THRESHOLD = 0.01;

async function ffprobeDuration(file: string): Promise<number> {
  const proc = Bun.spawn([
    "ffprobe",
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ], { stderr: "inherit" });
  const out = await new Response(proc.stdout).text();
  const val = parseFloat(out.trim());
  if (isNaN(val)) throw new Error(`Unable to get duration for ${file}`);
  return val;
}

async function main() {
  const originalDur = await ffprobeDuration(srcFile);
  console.log(`Original: ${originalDur.toFixed(3)}s`);

  // Find all partN.MTS files
  const splitFiles = (await readdir(splitDir))
    .filter(f => /^part\d+\.MTS$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let sum = 0;
  for (const file of splitFiles) {
    const fp = join(splitDir, file);
    const dur = await ffprobeDuration(fp);
    sum += dur;
    console.log(`${file}: ${dur.toFixed(3)}s`);
  }
  console.log(`\nSum of part durations: ${sum.toFixed(3)}s`);
  const diff = sum - originalDur;
  console.log(`Difference (sum - original): ${diff.toFixed(5)}s`);
  if (Math.abs(diff) < THRESHOLD) {
    console.log("Test PASSED: Split videos durations match the original.");
  } else {
    console.warn("Test WARNING: There is a non-trivial difference.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
