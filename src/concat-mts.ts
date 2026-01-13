import { readdir, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const sourceDir = join(process.cwd(), "concat_src");
import { paths } from "./paths";
const destDir = paths.rootConcatDir;
const outputFile = join(destDir, "all_in_one.MTS");
const myListPath = join(destDir, "mylist.txt");

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
  // List all .MTS files in sourceDir
  const files = (await readdir(sourceDir)).filter(f => f.endsWith(".MTS")).sort();

  // Prepare mylist.txt content
  const listContent = files.map(f => `file '${join(sourceDir, f)}'`).join("\n") + "\n";
  await writeFile(myListPath, listContent);
  console.log("mylist.txt written:\n", listContent);

  // Ensure output destination exists
  await mkdir(destDir, { recursive: true });

  // Run ffmpeg command
  const ffmpegCmd = [
    "ffmpeg",
    "-f", "concat",
    "-safe", "0",
    "-i", myListPath,
    "-c", "copy",
    outputFile,
  ];
  console.log("Running:", ffmpegCmd.join(" "));
  const proc = Bun.spawn(ffmpegCmd, { stdio: ["inherit", "inherit", "inherit"] });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`ffmpeg failed with code ${code}`);
    process.exit(1);
  } else {
    console.log("Concatenation successful:", outputFile);
  }

  // ---- Duration check ----
  console.log("\nChecking durations:");
  let sum = 0;
  for (const f of files) {
    const fpath = join(sourceDir, f);
    const dur = await ffprobeDuration(fpath);
    sum += dur;
    console.log(`${f}: ${dur.toFixed(3)}s`);
  }
  const outDur = await ffprobeDuration(outputFile);
  console.log(`\nSum of input durations: ${sum.toFixed(3)}s`);
  console.log(`Output file duration:    ${outDur.toFixed(3)}s`);
  const diff = Math.abs(sum - outDur);
  console.log(`Difference:              ${diff.toFixed(5)}s`);
  if (diff > 0.01) {
    console.warn("WARNING: Measurable duration difference detected!");
  } else {
    console.log("Durations match.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
