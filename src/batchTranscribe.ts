import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const splitDir = "youtube-video-concat/split";
const maxParts = 6;

for (let i = 1; i <= maxParts; i++) {
  const mts = join(splitDir, `part${i}.MTS`);
  const wav = join(splitDir, `part${i}.wav`);
  const txt = join(splitDir, `part${i}.txt`);

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
  console.log(`Transcribing ${wav} → ${txt}`);
  const proc = spawnSync("bun", ["run", "src/runTranscribe.ts", wav, txt], { stdio: "inherit" });
  if (proc.status !== 0) {
    console.error(`Transcription failed for ${wav}!`);
  }
  console.log("---");
}
