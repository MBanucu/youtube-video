import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";
import { generateDescriptionsFromPaths } from "./generate-description";
import { paths } from "./paths";

/**
 * Extract text content from SRT file, removing timestamps and indices.
 */
export function extractTextFromSRT(srtContent: string): string {
  const lines = srtContent.split('\n');
  const textLines = lines.filter(line => {
    // Skip empty lines, lines with only numbers (indices), or lines with --> (timestamps)
    const trimmed = line.trim();
    return trimmed && !/^\d+$/.test(trimmed) && !trimmed.includes('-->');
  });
  return textLines.join(' ');
}

/**
 * Batch generates descriptions for all txt files in the trans directory.
 * @param options Configuration options
 */
export async function batchGenerateDescriptions(options: {
  transDir?: string;
  descriptionsDir?: string;
} = {}) {
  const transDir = options.transDir || paths.transDir;
  const outDir = options.descriptionsDir || paths.descriptionsDir;

  // Ensure output folder exists
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const srtFiles = readdirSync(transDir)
    .filter(f => f.endsWith(".srt"))
    .sort();

  const jobs: Promise<void>[] = [];
  let delay = 0;

  for (const srt of srtFiles) {
    const srtPath = join(transDir, srt);
    const srtContent = readFileSync(srtPath, 'utf-8');
    const transcriptText = extractTextFromSRT(srtContent);

    // Create a temporary txt file with the extracted text
    const tempTxtPath = join(tmpdir(), `temp-${Date.now()}-${basename(srt, '.srt')}.txt`);
    writeFileSync(tempTxtPath, transcriptText);

    const inputFile = tempTxtPath;
    const base = basename(srt, ".srt");
    const outputFile = join(outDir, `${base}-description.txt`);

    for (const language of ["en", "de"] as const) {
      // Output file path per language
      const langFileSuffix = language === 'en' ? '_en.txt' : '_de.txt';
      const finalOutFile = outputFile.slice(0, -4) + langFileSuffix;
      if (existsSync(finalOutFile)) {
        console.log(`Skipping ${inputFile} (${language}): ${finalOutFile} already exists.`);
        continue;
      }
      // Launch each job with delay
      const job = ((delayMs, tempPath) => async () => {
        await new Promise(res => setTimeout(res, delayMs));
        console.log(`Starting ${language.toUpperCase()} for ${inputFile} after ${delayMs/1000}s ...`);
        try {
          await generateDescriptionsFromPaths(inputFile, outputFile, language);
        } catch (err) {
          console.error(`FAILED for ${inputFile} (${language}):`, err);
        } finally {
          // Clean up temp file
          try {
            unlinkSync(tempPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      })(delay, tempTxtPath);
      jobs.push(job());
      delay += 1000; // 1s between starts
    }
  }

  await Promise.all(jobs);
  console.log('All jobs complete.');
}

if (import.meta.main) {
  (async () => {
    // Dynamically import yargs at runtime
    const yargsMod = await import("yargs");
    const yargs = yargsMod.default;
    // @ts-ignore: ignore TS complaint about .argv promise (works in Bun/Node)
    const argv = await yargs(process.argv.slice(2))
      .usage("Usage: $0 [options]")
      .option("trans-dir", {
        describe: "Directory containing TXT transcript files",
        type: "string",
      })
      .option("descriptions-dir", {
        describe: "Directory for description output files",
        type: "string",
      })
      .help()
      .argv;
    await batchGenerateDescriptions({
      transDir: argv["trans-dir"],
      descriptionsDir: argv["descriptions-dir"],
    });
  })();
}