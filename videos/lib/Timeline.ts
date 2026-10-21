/**
 * Turns the timed steps of a recording into captions and YouTube chapters.
 */

/** A step as recorded: when it started, in seconds from the start of the video, and how long its
 * narration lasts. */
export interface TimedStep {
  id: string;
  chapter?: string;
  text: string;
  start: number;
  duration: number;
}

const MIN_CHAPTERS = 3;
const MIN_CHAPTER_SECONDS = 10;

const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

/** Seconds as a WebVTT time, "hh:mm:ss.mmm". */
export function vttTime (seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Seconds as a YouTube chapter time: "m:ss", or "h:mm:ss" past an hour. */
export function chapterTime (seconds: number): string {
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole / 60) % 60;
  const s = pad(whole % 60);
  return h > 0 ? `${h}:${pad(m)}:${s}` : `${m}:${s}`;
}

/** One caption cue per step, shown while its narration plays. */
export function toVtt (steps: TimedStep[]): string {
  const cues = steps.map((step) =>
    `${vttTime(step.start)} --> ${vttTime(step.start + step.duration)}\n${step.text}\n`
  );
  return `WEBVTT\n\n${cues.join("\n")}`;
}

/** The chapter list to paste into a YouTube description. */
export function toChapters (steps: TimedStep[]): string {
  return steps
    .filter((step) => step.chapter)
    .map((step) => `${chapterTime(step.start)} ${step.chapter}\n`)
    .join("");
}

/**
 * Where the chapters break YouTube's rules. YouTube shows no chapters at all when any rule is broken.
 * @param steps - The timed steps.
 * @param total - The video's length in seconds.
 */
export function chapterWarnings (steps: TimedStep[], total: number): string[] {
  const chapters = steps.filter((step) => step.chapter);
  const warnings: string[] = [];
  // Compare as the chapter list prints it: the first step starts a few milliseconds in.
  if (chapters.length === 0 || chapterTime(chapters[0].start) !== "0:00") {
    warnings.push("The first chapter must start at 0:00.");
  }
  if (chapters.length < MIN_CHAPTERS) {
    warnings.push(`YouTube needs at least ${MIN_CHAPTERS} chapters; this video has ${chapters.length}.`);
  }
  chapters.forEach((chapter, index) => {
    const end = chapters[index + 1]?.start ?? total;
    const length = end - chapter.start;
    if (length < MIN_CHAPTER_SECONDS) {
      warnings.push(
        `Chapter "${chapter.chapter}" is ${length.toFixed(1)} s long; YouTube needs at least ${MIN_CHAPTER_SECONDS} s.`
      );
    }
  });
  return warnings;
}
