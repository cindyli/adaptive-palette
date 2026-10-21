import { describe, expect, test } from "vitest";
import { TimedStep, chapterTime, chapterWarnings, toChapters, toVtt, vttTime } from "./Timeline.ts";

const steps: TimedStep[] = [
  { id: "a", chapter: "Welcome", text: "Hello.", start: 0, duration: 2 },
  { id: "b", text: "Next.", start: 12.5, duration: 1.25 },
  { id: "c", chapter: "Folders", text: "Open.", start: 20, duration: 3 },
  { id: "d", chapter: "End", text: "Bye.", start: 75.4, duration: 2 }
];

describe("Timeline", () => {
  test("vttTime formats hours, minutes, seconds and milliseconds", () => {
    expect(vttTime(0)).toBe("00:00:00.000");
    expect(vttTime(61.5)).toBe("00:01:01.500");
    expect(vttTime(3725.25)).toBe("01:02:05.250");
  });

  test("chapterTime uses m:ss, and h:mm:ss past an hour", () => {
    expect(chapterTime(0)).toBe("0:00");
    expect(chapterTime(75.9)).toBe("1:15");
    expect(chapterTime(3725)).toBe("1:02:05");
  });

  test("toVtt writes one cue per step, lasting as long as its narration", () => {
    expect(toVtt(steps.slice(0, 2))).toBe(
      "WEBVTT\n\n" +
      "00:00:00.000 --> 00:00:02.000\nHello.\n\n" +
      "00:00:12.500 --> 00:00:13.750\nNext.\n"
    );
  });

  test("toChapters lists each step that starts a chapter", () => {
    expect(toChapters(steps)).toBe("0:00 Welcome\n0:20 Folders\n1:15 End\n");
  });

  test("chapterWarnings is empty when YouTube's rules are met", () => {
    expect(chapterWarnings(steps, 90)).toEqual([]);
  });

  test("chapterWarnings accepts a first chapter a few milliseconds in", () => {
    expect(chapterWarnings([{ ...steps[0], start: 0.004 }, ...steps.slice(1)], 90)).toEqual([]);
  });

  test("chapterWarnings reports a short chapter", () => {
    expect(chapterWarnings(steps, 80)).toEqual([
      "Chapter \"End\" is 4.6 s long; YouTube needs at least 10 s."
    ]);
  });

  test("chapterWarnings reports too few chapters and a late first chapter", () => {
    const late = [{ id: "x", text: "Hi.", start: 0, duration: 1 }, { ...steps[2] }];
    expect(chapterWarnings(late, 60)).toEqual([
      "The first chapter must start at 0:00.",
      "YouTube needs at least 3 chapters; this video has 1."
    ]);
  });
});
