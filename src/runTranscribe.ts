import { spawn } from "child_process";
import { join } from "path";

/**
 * Runs the Python transcribe script for the given audio file, writes output.
 * Prints to stdout/stderr, resolves to the exit code.
 */
export function runTranscribe(
  audioPath: string,
  outputPath: string,
  model: string = "small",
  language: string = "de"
): Promise<number> {
  return new Promise((resolve) => {
    const pythonPath = join(process.cwd(), '.venv', 'bin', 'python3');
    const proc = spawn(pythonPath, [
      join("python", "transcribe.py"),
      audioPath,
      "--model", model,
      "--language", language,
      "--output", outputPath
    ]);
    proc.stdout.on("data", data => process.stdout.write(data));
    proc.stderr.on("data", data => process.stderr.write(data));
    proc.on("close", code => {
      if (code === 0) {
        console.log(`\nTranscription finished, output in ${outputPath}`);
      } else {
        console.error(`Transcription failed with exit code ${code}`);
      }
      resolve(code ?? 1);
    });
  });
}

if (import.meta.main) {
  (async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import("yargs");
    const yargs = yargsMod.default;
    // @ts-ignore: ignore TS complaint about .argv promise (works in Bun/Node)
    const argv = await yargs(process.argv.slice(2))
      .usage("Usage: $0 --audio <input.wav> --output <output.srt> [options]")
      .option("audio", {
        alias: "a",
        describe: "Path to input audio file",
        type: "string",
        demandOption: true,
      })
      .option("output", {
        alias: "o",
        describe: "Output SRT file path",
        type: "string",
        demandOption: true,
      })
      .option("model", {
        describe: "Model size for transcription",
        type: "string",
        default: "small"
      })
      .option("language", {
        alias: "l",
        describe: "Language code (e.g., de, en)",
        type: "string",
        default: "de"
      })
      .help()
      .argv;
    await runTranscribe(argv.audio, argv.output, argv.model, argv.language);
  })();
}
