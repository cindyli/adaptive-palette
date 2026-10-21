/**
 * Text to speech. The only place that calls a speech engine, so changing the voice or the engine
 * (Piper, a cloud voice) changes this file only.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The `say` voice for each narration language. A fixed voice keeps recordings the same. Premium voices
 * sound the most natural; download them in System Settings (see the README).
 */
export const VOICES: Record<string, string> = { en: "Zoe (Premium)" };
/** Words per minute. Slower than the voice's own rate (about 165), so listeners can follow. */
const RATE = "150";
/** Silence after each sentence, in `say`'s embedded command syntax, so ideas stay apart. */
const SENTENCE_PAUSE = "[[slnc 600]]";

/**
 * Speak `text` into an audio file.
 * @param text - What to say.
 * @param lang - The narration language; must have a voice in `VOICES`.
 * @param outFile - Where to write the clip; an `.aiff` path.
 * @returns The clip's length in seconds.
 */
export async function narrate (text: string, lang: string, outFile: string): Promise<number> {
  const voice = VOICES[lang];
  if (!voice) {
    throw new Error(`No voice for language "${lang}". Add one to VOICES in videos/lib/Narrate.ts.`);
  }
  // `say` quietly uses the default voice when the one asked for is not installed.
  const { stdout: installed } = await run("say", ["-v", "?"]);
  if (!installed.split("\n").some((line) => line.startsWith(`${voice} `))) {
    throw new Error(`The voice "${voice}" is not installed. See "Requirements" in videos/README.md.`);
  }
  const spoken = text.replace(/([.!?:])\s+/g, `$1 ${SENTENCE_PAUSE} `);
  await run("say", ["-v", voice, "-r", RATE, "-o", outFile, spoken]);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outFile
  ]);
  return Number(stdout.trim());
}
