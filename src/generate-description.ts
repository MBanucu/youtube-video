import yargs from "yargs";
import path from "path";

const argv = yargs(process.argv.slice(2))
  .usage("Usage: $0 --input <input.txt> --output <output.txt>")
  .option("input", {
    alias: "i",
    describe: "Transcription (.txt) file to read",
    type: "string",
    demandOption: false,
    default: path.join(process.cwd(), "youtube-video-concat", "split", "part1.txt"),
  })
  .option("output", {
    alias: "o",
    describe: "Base output file name (will create _en.txt and _de.txt)",
    type: "string",
    demandOption: false,
    default: path.join(process.cwd(), "youtube-video-concat", "description.txt"),
  })
  .help()
  .argv;


function getOutputPaths(baseOutputPath: string) {
  return {
    en: baseOutputPath.replace(/\.txt$/, '_en.txt'),
    de: baseOutputPath.replace(/\.txt$/, '_de.txt'),
  };
}


async function readStream(
  stream: AsyncIterable<Uint8Array> | null | undefined,
  to: "stdout" | "stderr" = "stdout"
): Promise<string> {
  let content = "";
  if (stream) {
    for await (const chunk of stream) {
      const decoded = new TextDecoder().decode(chunk);
      content += decoded;
      if (to === "stdout") {
        process.stdout.write(decoded);
      } else {
        process.stderr.write(decoded);
      }
    }
  }
  return content;
}

async function generateDescription(prompt: string, maxRetries = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const proc = Bun.spawn([
      "opencode", "run", "--model", "opencode/grok-code", prompt
    ], { stdio: ["ignore", "pipe", "pipe"] });

    const [output, stderr] = await Promise.all([
      readStream(proc.stdout, "stdout"),
      readStream(proc.stderr, "stderr"),
    ]);
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return output
        .replace(/^[\s\S]*?(?=Hier ist|Hier kommt|Die Beschreibung)/, "")
        .replace(/^[\s\S]*?(?=Here is)/, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/Final Answer:?c?\s*/i, "")
        .replace(/Antwort:?c?\s*/i, "")
        .trim();
    } else {
      console.error(
        `opencode failed (attempt ${attempt}/${maxRetries}) with code ${exitCode}. stderr:`,
        stderr
      );
      if (attempt < maxRetries)
        await new Promise(res => setTimeout(res, 1000)); // Always wait 1 second between retries
    }
  }
  throw new Error(`opencode failed after ${maxRetries} retries.`);
}

async function describeAndWrite(prompt: string, outputPath: string, label: string) {
  const desc = await generateDescription(prompt);
  console.log(`Generated ${label} description:\n`);
  console.log(desc);
  await Bun.write(outputPath, desc);
  console.log(`\n${label} description written to ${outputPath}`);
  return desc;
}

export async function generateDescriptionsFromPaths(transcriptionPath: string, baseOutputPath: string, language: 'en' | 'de' | 'both' = 'both') {
  try {
    const transcription = await Bun.file(transcriptionPath).text();

    // English prompt (remains in English)
    const enPrompt = `You are an expert YouTube content creator. Create an engaging, SEO-optimized video description based on this transcription. Include:
- A catchy hook in the first 1-2 sentences
- A concise summary of the key points
- Timestamps for main sections (if identifiable)
- Relevant hashtags
- A strong call to action (subscribe, like, comment, etc.)

Output ONLY the final YouTube description text in English — no extra explanations, no markdown, no thinking steps.

Transcription:
${transcription}`;

    // German prompt — now fully in German
    const dePrompt = `Du bist ein erfahrener YouTube-Content-Creator. Erstelle eine ansprechende, SEO-optimierte Videobeschreibung auf Deutsch basierend auf dieser Transkription. Die Beschreibung muss enthalten:
- Einen fesselnden Einstiegshook in den ersten 1–2 Sätzen
- Eine knappe Zusammenfassung der wichtigsten Inhalte
- Zeitstempel für die Hauptabschnitte (falls erkennbar)
- Passende Hashtags
- Einen starken Call-to-Action (Abonnieren, liken, kommentieren usw.)

Gib NUR den finalen Text der YouTube-Beschreibung auf Deutsch aus — keine zusätzlichen Erklärungen, kein Markdown, keine Denkprozesse oder Einleitungen.

Transkription:
${transcription}`;

    const { en: outputEnPath, de: outputDePath } = getOutputPaths(baseOutputPath);

    let enDescription: string | undefined = undefined;
    let deDescription: string | undefined = undefined;

    if (language === 'en') {
      enDescription = await describeAndWrite(enPrompt, outputEnPath, 'English');
    } else if (language === 'de') {
      deDescription = await describeAndWrite(dePrompt, outputDePath, 'German');
    } else {
      const enPromise = describeAndWrite(enPrompt, outputEnPath, 'English');
      await new Promise(res => setTimeout(res, 1000)); // 1s delay before starting German description
      const dePromise = describeAndWrite(dePrompt, outputDePath, 'German');
      [enDescription, deDescription] = await Promise.all([enPromise, dePromise]);
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}


// CLI entry point
if (import.meta.main) {
  const tp = argv.input;
  const bp = argv.output;
  generateDescriptionsFromPaths(tp, bp);
}
