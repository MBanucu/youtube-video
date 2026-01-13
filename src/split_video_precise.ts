import { mkdir } from "fs/promises";
import { join } from "path";

const sourceDir = process.cwd();
import { paths } from "./paths";
const splitDir = paths.videosDir;
const { rootConcatDir } = paths;
const outputDir = rootConcatDir;
const srcFile = join(outputDir, "all_in_one.MTS");
const PARTS = 6;

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

async function splitPrecise() {
  await mkdir(splitDir, { recursive: true });
  const duration = await ffprobeDuration(srcFile);
  let start = 0;
  let remaining = duration;

  for (let i = 1; i <= PARTS; i++) {
    const outFile = join(splitDir, `part${i}.MTS`);
    const remParts = PARTS - (i - 1);
    const partDuration = remaining / remParts;
    const partDurationStr = partDuration.toFixed(3);
    const startStr = start.toFixed(3);

    const ffmpegCmd = [
      "ffmpeg",
      "-ss", startStr,
      "-i", srcFile,
      ...(i === PARTS ? [] : ["-t", partDurationStr]),
      "-c", "copy",
      outFile,
    ];
    console.log(`Splitting part${i}: ffmpeg ${ffmpegCmd.join(" ")}`);
    const proc = Bun.spawn(ffmpegCmd, { stdio: ["inherit", "inherit", "inherit"] });
    const code = await proc.exited;
    if (code !== 0) {
      console.error(`ffmpeg failed for part${i} with code ${code}`);
      process.exit(1);
    }
    const actualDuration = await ffprobeDuration(outFile);
    console.log(`part${i}.MTS: ${actualDuration.toFixed(3)}s`);
    start += actualDuration;
    remaining -= actualDuration;
  }

  console.log("Splitting complete.");
}

splitPrecise().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
