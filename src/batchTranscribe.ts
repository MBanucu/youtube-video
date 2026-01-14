import { existsSync } from "fs";
import { join } from "path";
import { readdirSync, mkdirSync } from "fs";
import { extractWavFromVideo } from "@/extract-wav";
import { runTranscribe } from "@/runTranscribe";
import { paths } from "@/paths";

/**
 * Batch transcribes all MTS videos in the videos directory to SRT subtitles.
 * @param options Configuration options
 */
export async function batchTranscribe(options: {
  videosDir?: string;
  audiosDir?: string;
  transDir?: string;
  model?: string;
  language?: string;
} = {}) {
  const videosDir = options.videosDir || paths.videosDir;
  const audiosDir = options.audiosDir || paths.audiosDir;
  const transDir = options.transDir || paths.transDir;
  const model = options.model || "small";
  const language = options.language || "de";

  // Ensure output folders exist
  for (const dir of [audiosDir, transDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const mtsFiles = readdirSync(videosDir).filter(f => f.endsWith(".MTS")).sort();

  for (const mtsBase of mtsFiles) {
    const partName = mtsBase.replace(/\.MTS$/i, "");
    const mts = join(videosDir, mtsBase);
    const wav = join(audiosDir, partName + ".wav");
    const srt = join(transDir, partName + ".srt");

    // Convert MTS to WAV if needed
    if (!existsSync(wav)) {
      const ok = extractWavFromVideo(mts, wav);
      if (!ok) continue;
    } else {
      console.log(`${wav} already exists; skipping conversion.`);
    }

    // Transcribe
    console.log(`Transcribing ${wav} → ${srt}`);
    const exitCode = await runTranscribe(wav, srt, model, language);
    if (exitCode !== 0) {
      console.error(`Transcription failed for ${wav}!`);
    }
    console.log("---");
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
      .option("videos-dir", {
        describe: "Directory containing MTS video files",
        type: "string",
      })
      .option("audios-dir", {
        describe: "Directory for WAV audio files",
        type: "string",
      })
      .option("trans-dir", {
        describe: "Directory for SRT transcript files",
        type: "string",
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
    await batchTranscribe({
      videosDir: argv["videos-dir"],
      audiosDir: argv["audios-dir"],
      transDir: argv["trans-dir"],
      model: argv.model,
      language: argv.language,
    });
  })();
}
