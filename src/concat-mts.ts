import { readdir, writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { paths } from "@/paths";
import { ffprobeDuration } from "@/utils";

/**
 * Concatenates multiple MTS video files into a single output file using ffmpeg.
 * @param options Configuration options
 */
export async function concatMts(options: {
  sourceDir?: string;
  outputDir?: string;
  outputFileName?: string;
  fileListName?: string;
} = {}) {
  const sourceDir = options.sourceDir || join(process.cwd(), "concat_src");
  const destDir = options.outputDir || paths.rootConcatDir;
  const outputFileName = options.outputFileName || "all_in_one.MTS";
  const fileListName = options.fileListName || "concat-filelist.txt";
  const outputFile = join(destDir, outputFileName);
  const myListPath = join(destDir, fileListName);

  // List all .MTS files in sourceDir
  const files = (await readdir(sourceDir)).filter(f => f.endsWith(".MTS")).sort();

  // Prepare mylist.txt content
  const listContent = files.map(f => `file '${resolve(join(sourceDir, f))}'`).join("\n") + "\n";
  await writeFile(myListPath, listContent);
  console.log(`${fileListName} written:\n`, listContent);

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
    throw new Error(`ffmpeg failed with code ${code}`);
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

if (import.meta.main) {
  (async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import("yargs");
    const yargs = yargsMod.default;
    // @ts-ignore: ignore TS complaint about .argv promise (works in Bun/Node)
    const argv = await yargs(process.argv.slice(2))
      .usage("Usage: $0 [options]")
      .option("source-dir", {
        describe: "Directory containing MTS files to concatenate",
        type: "string",
      })
      .option("output-dir", {
        describe: "Directory for output file",
        type: "string",
      })
      .option("output-file-name", {
        describe: "Name of the output MTS file",
        type: "string",
      })
      .option("file-list-name", {
        describe: "Name of the file list for ffmpeg concat",
        type: "string",
      })
      .help()
      .argv;
    await concatMts({
      sourceDir: argv["source-dir"],
      outputDir: argv["output-dir"],
      outputFileName: argv["output-file-name"],
      fileListName: argv["file-list-name"],
    });
  })().catch((err: any) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
