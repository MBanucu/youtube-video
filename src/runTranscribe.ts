import { spawn } from "child_process";

// Path to the audio file and output file
const audioPath = process.argv[2] || "audio.wav";
const outputPath = process.argv[3] || "transcript.txt";

const proc = spawn("python3", [
  require("path").join("python", "transcribe.py"),
  audioPath,
  "--model", "small",
  "--language", "de",
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
});
