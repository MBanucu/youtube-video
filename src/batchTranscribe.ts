import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

import { readdirSync, mkdirSync } from "fs";
import { paths } from "./paths";

const { videosDir, audiosDir, transDir } = paths;

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
    console.log(`Converting ${mts} → ${wav}`);
    const conv = spawnSync("ffmpeg", ["-i", mts, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", wav], { stdio: "inherit" });
    if (conv.status !== 0) {
      console.error(`ffmpeg failed for ${mts}!`);
      continue;
    }
  } else {
    console.log(`${wav} already exists; skipping conversion.`);
  }

  // Transcribe
  console.log(`Transcribing ${wav} → ${srt}`);
  const proc = spawnSync("bun", ["run", join("src", "runTranscribe.ts"), wav, srt], { stdio: "inherit" });
  if (proc.status !== 0) {
    console.error(`Transcription failed for ${wav}!`);
  }
  console.log("---");
}

