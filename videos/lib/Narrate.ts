/**
 * Text to speech. The only place that calls a speech engine, so changing the voice or the engine
 * changes this file (and `kokoro.py`) only.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Where the Kokoro Python environment and model files are installed (see the README). */
const KOKORO_DIR = path.join(homedir(), ".cache", "adaptive-palette-kokoro");
const PYTHON = path.join(KOKORO_DIR, "venv", "bin", "python");
const SCRIPT = path.join(import.meta.dirname, "kokoro.py");

/**
 * The Kokoro voice and pronunciation language for each narration language. A fixed voice keeps
 * recordings the same. Voices are listed at https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md.
 */
export const VOICES: Record<string, { voice: string, lang: string }> = {
  en: { voice: "af_heart", lang: "en-us" }
};
/** Seconds of silence after each sentence, so ideas stay apart. */
const SENTENCE_PAUSE = "0.6";

/**
 * Speak `text` into an audio file.
 * @param text - What to say.
 * @param lang - The narration language; must have a voice in `VOICES`.
 * @param outFile - Where to write the clip; a `.wav` path.
 * @returns The clip's length in seconds.
 */
export async function narrate (text: string, lang: string, outFile: string): Promise<number> {
  const voice = VOICES[lang];
  if (!voice) {
    throw new Error(`No voice for language "${lang}". Add one to VOICES in videos/lib/Narrate.ts.`);
  }
  if (!existsSync(PYTHON)) {
    throw new Error(`Kokoro is not installed in ${KOKORO_DIR}. See "Requirements" in videos/README.md.`);
  }
  await run(PYTHON, ["-I", SCRIPT, KOKORO_DIR, voice.voice, voice.lang, SENTENCE_PAUSE, outFile, text]);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outFile
  ]);
  return Number(stdout.trim());
}
