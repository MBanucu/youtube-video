import { readdir, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const sourceDir = join(process.cwd(), "concat_src");
const destDir = join(process.cwd(), "youtube-video-concat");
const outputFile = join(destDir, "all_in_one.MTS");
const myListPath = join(process.cwd(), "mylist.txt");

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
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
