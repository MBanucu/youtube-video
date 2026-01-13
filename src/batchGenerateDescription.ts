import { readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { generateDescriptionsFromPaths } from "./generate-description";

const splitDir = "youtube-video-concat/split";
const outDir = "youtube-video-concat/split/descriptions";

const txtFiles = readdirSync(splitDir)
  .filter(f => f.endsWith(".txt") && !f.endsWith("-description.txt"))
  .sort();

(async () => {
  const jobs: Promise<void>[] = [];
  let delay = 0;

  for (const txt of txtFiles) {
    const inputFile = join(splitDir, txt);
    const base = basename(txt, ".txt");
    const outputFile = join(outDir, `${base}-description.txt`);

    for (const language of ["en", "de"] as const) {
      // Output file path per language
      const langFileSuffix = language === 'en' ? '_en.txt' : '_de.txt';
      const finalOutFile = outputFile.replace(/\.txt$/, langFileSuffix);
      if (existsSync(finalOutFile)) {
        console.log(`Skipping ${inputFile} (${language}): ${finalOutFile} already exists.`);
        continue;
      }
      // Launch each job with delay
      const job = ((delayMs) => async () => {
        await new Promise(res => setTimeout(res, delayMs));
        console.log(`Starting ${language.toUpperCase()} for ${inputFile} after ${delayMs/1000}s ...`);
        try {
          await generateDescriptionsFromPaths(inputFile, outputFile, language);
        } catch (err) {
          console.error(`FAILED for ${inputFile} (${language}):`, err);
        }
      })(delay)();
      jobs.push(job);
      delay += 1000; // 1s between starts
    }
  }

  await Promise.all(jobs);
  console.log('All jobs complete.');
})();
