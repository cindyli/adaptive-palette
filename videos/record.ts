/**
 * Records a feature video: `npm run video -- <name> [--lang en]`.
 *
 * 1. Speak each step's narration into a clip and measure it.
 * 2. Start the dev server and open the app in Chromium at 1280×720, recording, with Ollama stubbed.
 * 3. Run each step and hold it for its clip plus a pause, longer before a new chapter.
 * 4. Scale the recording to 1920×1080 and combine it with the clips, each at its step's start.
 * 5. Write the captions and the YouTube description with its chapters, and record the version.
 *
 * Everything is made in a temporary folder and copied to `videos/output/` only when every step
 * succeeded, so a failed run leaves no partial output.
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { type BrowserContext, chromium, type Page } from "playwright";
import { createServer } from "vite";
import { clearOverlay, highlight, installOverlay, showTitle } from "./lib/Highlight.ts";
import { narrate } from "./lib/Narrate.ts";
import { type StubFile, installStubs } from "./lib/Stubs.ts";
import { type TimedStep, chapterWarnings, toChapters, toVtt } from "./lib/Timeline.ts";

/** One step of a video script. */
export interface Step {
  /** Names the step's narration in `narration.<lang>.json`. */
  id: string;
  /** Starts a YouTube chapter with this title. */
  chapter?: string;
  /** What happens on screen, run as the narration starts. */
  action?: (page: Page) => Promise<void>;
  /** A selector for the area to outline. None shows the whole screen. */
  highlight?: string;
  /** Show the narration as a title card covering the screen, for at least `TITLE_SECONDS`. Also works
   * mid-video, as a slide between parts. */
  title?: boolean;
}

/** What a script's `steps.ts` exports. */
export interface Script {
  steps: Step[];
  /** Changes the browser before the app opens, such as routing a palette file to a changed copy. */
  prepare?: (context: BrowserContext) => Promise<void>;
}

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const VIDEOS = import.meta.dirname;
const PORT = 3100;
// A laptop-sized screen, so buttons, symbols and text keep the proportions people see. A larger
// screen stretches the buttons while text and symbols keep their size. The video is scaled up
// to `OUTPUT_SIZE`, since Playwright records CSS pixels and ignores `deviceScaleFactor`.
const SIZE = { width: 1280, height: 720 };
const OUTPUT_SIZE = "1920:1080";
const PAUSE_SECONDS = 1;
// A longer pause before a new chapter marks the change of topic.
const CHAPTER_PAUSE_SECONDS = 2;
const TITLE_SECONDS = 3;
const TOOLS: Record<string, string> = {
  say: "`say` comes with macOS; record on a Mac.",
  ffmpeg: "Install it with `brew install ffmpeg`.",
  ffprobe: "It comes with ffmpeg: `brew install ffmpeg`."
};

/** Read `<name> [--lang <lang>]` from the command line. */
function parseArgs (): { name: string; lang: string } {
  const args = process.argv.slice(2);
  const langIndex = args.indexOf("--lang");
  const lang = langIndex === -1 ? "en" : args[langIndex + 1];
  const name = args.find((arg, index) => !arg.startsWith("--") && (langIndex === -1 || index !== langIndex + 1));
  if (!name || !lang) {
    throw new Error("Usage: npm run video -- <name> [--lang en]");
  }
  return { name, lang };
}

async function checkTools (): Promise<void> {
  for (const [tool, hint] of Object.entries(TOOLS)) {
    try {
      await run("which", [tool]);
    } catch {
      throw new Error(`\`${tool}\` is not installed. ${hint}`);
    }
  }
}

async function readJson<T> (file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/** The narration for every step, or an error naming the steps that have none. */
async function loadNarration (scriptDir: string, lang: string, steps: Step[]): Promise<Record<string, string>> {
  const file = path.join(scriptDir, `narration.${lang}.json`);
  let narration: Record<string, string>;
  try {
    narration = await readJson<Record<string, string>>(file);
  } catch {
    throw new Error(`No narration file for "${lang}": ${path.relative(ROOT, file)}`);
  }
  const missing = steps.filter((step) => !narration[step.id]).map((step) => step.id);
  if (missing.length > 0) {
    throw new Error(`No "${lang}" narration for steps: ${missing.join(", ")}`);
  }
  return narration;
}

/** The video's YouTube description, from `description.<lang>.txt` with its chapters filled in. */
async function loadDescription (scriptDir: string, lang: string, chapters: string): Promise<string> {
  const file = path.join(scriptDir, `description.${lang}.txt`);
  let template: string;
  try {
    template = await readFile(file, "utf8");
  } catch {
    throw new Error(`No description file for "${lang}": ${path.relative(ROOT, file)}`);
  }
  if (!template.includes("{{chapters}}")) {
    throw new Error(`${path.relative(ROOT, file)} has no {{chapters}} line.`);
  }
  return template.replace("{{chapters}}\n", chapters).replace("{{chapters}}", chapters);
}

/** Drive the app through the steps. Returns the video file, the timed steps and the video's length. */
async function recordSteps (
  { steps, prepare }: Script, durations: number[], narration: Record<string, string>, stubs: StubFile, workDir: string
): Promise<{ video: string; timed: TimedStep[]; offset: number; total: number }> {
  const server = await createServer({
    root: ROOT, logLevel: "error", server: { port: PORT, strictPort: true }
  });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: workDir, size: SIZE }
    });
    const unanswered = await installStubs(context, stubs);
    await prepare?.(context);
    const page = await context.newPage();
    const videoStart = Date.now();
    await page.goto(`http://localhost:${PORT}/`);
    await page.locator(".screenPalette").waitFor();
    await installOverlay(page);

    const timed: TimedStep[] = [];
    const t0 = Date.now();
    const elapsed = (): number => (Date.now() - t0) / 1000;
    for (const [index, step] of steps.entries()) {
      const start = elapsed();
      timed.push({ id: step.id, chapter: step.chapter, text: narration[step.id], start, duration: durations[index] });
      try {
        await clearOverlay(page);
        if (step.title) {
          await showTitle(page, narration[step.id]);
        }
        await step.action?.(page);
        await highlight(page, step.highlight);
      } catch (error) {
        throw new Error(`Step "${step.id}": ${(error as Error).message}`, { cause: error });
      }
      const pause = steps[index + 1]?.chapter ? CHAPTER_PAUSE_SECONDS : PAUSE_SECONDS;
      const holdUntil = start + Math.max(durations[index], step.title ? TITLE_SECONDS : 0) + pause;
      await page.waitForTimeout(Math.max(0, holdUntil - elapsed()) * 1000);
    }
    const total = elapsed();
    const offset = (t0 - videoStart) / 1000;

    await context.close();
    if (unanswered.length > 0) {
      throw new Error(`Ollama requests with no stub:\n${unanswered.join("\n")}`);
    }
    return { video: await page.video()!.path(), timed, offset, total };
  } finally {
    try {
      await browser.close();
    } finally {
      await server.close();
    }
  }
}

/** Put each clip at its step's start and combine them with the recording, from `offset` on. */
async function combine (
  video: string, clips: string[], timed: TimedStep[], offset: number, total: number, outFile: string
): Promise<void> {
  const delays = timed.map((step, index) => `[${index + 1}:a]adelay=${Math.round(step.start * 1000)}:all=1[a${index}]`);
  const mix = `${timed.map((_, index) => `[a${index}]`).join("")}amix=inputs=${timed.length}:normalize=0[aout]`;
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-ss", offset.toFixed(3), "-i", video,
    ...clips.flatMap((clip) => ["-i", clip]),
    "-filter_complex", [`[0:v]scale=${OUTPUT_SIZE}:flags=lanczos[vout]`, ...delays, mix].join(";"),
    "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(3),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
    outFile
  ]);
}

/**
 * Record today's date and the current commit for this video and language. Keeps its YouTube URL.
 * The commit ends in "-dirty" when the code had uncommitted changes, other than versions.json itself.
 */
async function updateVersions (name: string, lang: string): Promise<void> {
  const file = path.join(VIDEOS, "versions.json");
  const versions = await readJson<Record<string, Record<string, { recorded: string; commit: string; youtube: string }>>>(file);
  const { stdout } = await run("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT });
  const { stdout: changes } = await run("git", ["status", "--porcelain", "--", ".", ":!videos/versions.json"], { cwd: ROOT });
  const commit = stdout.trim() + (changes.trim() ? "-dirty" : "");
  const previous = versions[name]?.[lang];
  versions[name] = {
    ...versions[name],
    [lang]: { recorded: new Date().toISOString().slice(0, 10), commit, youtube: previous?.youtube ?? "" }
  };
  await writeFile(file, `${JSON.stringify(versions, null, 2)}\n`);
}

async function main (): Promise<void> {
  const { name, lang } = parseArgs();
  await checkTools();
  const scriptDir = path.join(VIDEOS, "scripts", name);
  const script = await import(path.join(scriptDir, "steps.ts")) as Script;
  const { steps } = script;
  const narration = await loadNarration(scriptDir, lang, steps);
  const stubs = await readJson<StubFile>(path.join(scriptDir, "stubs.json"));

  const workDir = await mkdtemp(path.join(tmpdir(), `video-${name}-`));
  try {
    console.log(`1. Narrating ${steps.length} steps`);
    const clips = steps.map((step) => path.join(workDir, `${step.id}.wav`));
    const durations: number[] = [];
    for (const [index, step] of steps.entries()) {
      durations.push(await narrate(narration[step.id], lang, clips[index]));
    }

    console.log("2. Recording");
    const { video, timed, offset, total } = await recordSteps(script, durations, narration, stubs, workDir);

    console.log("3. Combining video and narration");
    const base = `${name}.${lang}`;
    await combine(video, clips, timed, offset, total, path.join(workDir, `${base}.mp4`));
    await writeFile(path.join(workDir, `${base}.vtt`), toVtt(timed));
    await writeFile(path.join(workDir, `${base}.description.txt`), await loadDescription(scriptDir, lang, toChapters(timed)));

    const outDir = path.join(VIDEOS, "output");
    await mkdir(outDir, { recursive: true });
    // Before the copy, so a git failure leaves no new output.
    await updateVersions(name, lang);
    for (const extension of ["mp4", "vtt", "description.txt"]) {
      await copyFile(path.join(workDir, `${base}.${extension}`), path.join(outDir, `${base}.${extension}`));
    }

    for (const warning of chapterWarnings(timed, total)) {
      console.warn(`Warning: ${warning}`);
    }
    console.log(`Done: videos/output/${base}.mp4 (${total.toFixed(1)} s)`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
