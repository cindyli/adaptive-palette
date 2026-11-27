# Feature videos

Short videos that teach people to use Adaptive Palette. Each video is a script, so it can be recorded again
after the UI changes.

## Requirements

1. A Mac.
2. Kokoro, a free voice model that runs on your computer, for the narration. Install it once:

   ```bash
   brew install espeak-ng   # pronunciation; the copy Kokoro bundles fails on Intel Macs
   K=~/.cache/adaptive-palette-kokoro
   mkdir -p $K && cd $K
   python3.11 -m venv venv   # Python 3.10 to 3.13; Intel Macs have no onnxruntime for 3.14
   venv/bin/pip install kokoro-onnx soundfile
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
   ```

3. ffmpeg and ffprobe. Install them one of two ways:
   - `brew install ffmpeg`. Warnings that Xcode or the Command Line Tools are outdated can be ignored, but
     if Homebrew has no ready-made package for your Mac (common on Intel Macs), it builds ffmpeg and its
     dependencies from source. That can take hours or fail with older tools. Stop it (Ctrl+C) and use the
     next option.
   - Download the ready-made `ffmpeg` and `ffprobe` zips from <https://evermeet.cx/ffmpeg/> (Intel Macs) or
     <https://ffmpeg.martin-riedl.de/> (Intel or Apple silicon). Unzip them, then:

     ```bash
     sudo mv ffmpeg ffprobe /usr/local/bin/
     xattr -d com.apple.quarantine /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
     ffmpeg -version   # check it runs
     ```

4. Playwright's Chromium, already installed for the tests. If not: `npx playwright install chromium`.

No Ollama is needed. Model replies come from each video's `stubs.json`.

## Record a video

```bash
npm run video -- welcome            # English
npm run video -- welcome --lang en
npm run video -- layout             # Welcome and Palette Layout
```

This writes to `videos/output/` (not committed):

- `welcome.en.mp4` — the video with narration
- `welcome.en.vtt` — captions
- `welcome.en.description.txt` — the YouTube description, with chapters

It also sets the video's date and commit in `versions.json`.

## Check a video

Find the latest recording of each video in `versions.json`: the date, the commit it was recorded from,
and its YouTube link. Compare the commit with the current code to decide whether to record again.

Watch the video and check that:

1. Symbols and captions are readable on a laptop screen.
2. The narration matches what is on screen at every step.
3. Changes between steps are smooth: no blank screen and no flash.

## Publish a video

1. Upload the `.mp4` to YouTube.
2. Add the `.vtt` as subtitles.
3. Paste the description file into the description.
4. Put the YouTube link in the video's `youtube` field in `versions.json`.

## Add a video

1. Create `scripts/<name>/` with `steps.ts`, `narration.en.json`, `description.en.txt` and `stubs.json`. Copy
   `scripts/welcome/`. The runner puts the chapters in place of the `{{chapters}}` line in the description.
2. Each step has an `id`; `narration.<lang>.json` has the text for every id.
3. Give the first step `title: true` to show its narration as a title card, for at least 3 seconds. The video
   opens on it. Give `title` text to show that text on the card in place of the narration, which is still
   spoken. A title step mid-video works as a slide between parts. An action under a title card must not open a
   dialog, because a dialog draws above the card.
4. Give the last step `credits: true` to show the funder credits, `assets/credits.<lang>.html`, on a white card
   for at least 3 seconds. The narration is still spoken.
5. Give a step `slide: "<file>.html"` to show that file from the script folder as a full-screen card, for at least
   3 seconds. Images in it use their path from the repo root, such as `/videos/scripts/layout/image.jpg`. A
   reload under a slide keeps it up, as under a title card. `scripts/layout/` builds a list up one line per step
   with one slide per step.
6. Give a step `banner` text to show it as a strip across the top with the app shrunk below it.
7. Put the video's own look in `theme.css` in the script folder. It is added after the runner's styles, so it can
   restyle `#videoTitle`, `#videoBanner`, `#videoHighlight`, `.videoArrow` and `.videoArrowLabel`, and style its
   slides. `scripts/layout/` uses it to follow a design.
8. Give a step a `chapter` to start a YouTube chapter. YouTube needs at least 3 chapters, each at least
   10 seconds long; the runner warns when they are not.
9. List every model that `public/config.json` asks for in `stubs.json` `models`, or the first-run setup
   dialog covers the screen. The runner fails if the app asks Ollama for something with no stub.
10. To show something no shipped palette has, export `prepare(context)` from `steps.ts` and route the
   palette file to a changed copy there. `scripts/welcome/` does this to show pictures.
11. To set app data before the video starts, export `setup(page)` from `steps.ts`. It runs once the app has
    loaded, and nothing it does is seen. `scripts/layout/` saves messages there so the word suggestions are filled.
12. Export `style = "drawn"` for the look of a hand-made screen recording: red boxes and arrows that draw
    themselves on, and a pointer that glides from click to click, rests before each click and holds after it.
    `scripts/layout/` uses it.

When writing the steps:

1. Reload the page or reset its data only in a step with a title card, so the reload is not seen. The card
   stays up while the page reloads. `scripts/welcome/` does this in its `privacy` step.
2. Highlight only what the narration is talking about. When there is nothing on screen to point at, such
   as privacy, use a title card with short text.
3. Keep title card text short. The runner removes a trailing period.
4. The runner handles the look: a magenta outline with the rest dimmed, a box that glides between areas,
   and a pointer for each click, held for a second after it. A click hides the highlight, and a highlight hides
   the pointer. A title card fades out onto the next step that has no card. When that step only highlights,
   the highlight is drawn under the card first.
5. To set app state the screen cannot reach, import the app's module in `page.evaluate` by its dev server
   path, such as `/src/client/features/about-me/AboutMeState.ts`. That gives the app's own copy.
   `scripts/welcome/` does this to fill About Me.
6. To point at something, call `arrow(page, selector)` from `lib/Highlight.ts` for a plain arrow from below, or
   `arrow(page, selector, "label")` for a labelled arrow from the left. Arrows stay until the next step.
7. To show pictures on the home board, call `routePictures` from `lib/Pictures.ts` in `prepare`.
8. In the drawn style, `click(page, selector, { box: true })` draws a box around a cell before clicking it, and
   `drawArrow(page, to, { from })` draws a curved arrow from one element to another, or with `{ corner: true }` to
   a folder's fold.

## Lessons from making video

Writing the narration:

1. Read aloud everything shown as text, such as a list of videos on a slide. Many AAC users rely on hearing
   more than reading. To hold one slide through a long reading, split the reading into steps that each show the
   same slide.
2. Name one thing at a time, in the order the screen marks it, so each phrase has one box or arrow to land on.
3. Keep one idea per step. A short step is easier to time, and the step's start is a fixed point to time from.

Making the screen look like real use:

1. Fill the app as a real user's would be. Save data in `setup` and give `stubs.json` replies, so rows such as
   the word suggestions are not empty. A stubbed reply still takes about a second to show after each change.
2. Go at a pace a viewer can follow: the pointer glides to each cell, rests, clicks and holds. Never let it
   jump or appear from nowhere.
3. Mark what is about to change before the click, as with `click(..., { box: true })`. A box left after a click
   that changes the page sits over whatever cell is now there.
4. Something with no element of its own, such as a folder's fold, can still be pointed at from its cell's box.

Timing the marks to the narration:

1. Waits in an action count from when the step's narration starts. Find when a phrase is spoken from the
   recording, with `ffmpeg -i videos/output/<name>.en.mp4 -af silencedetect=noise=-30dB:d=0.3 -f null -`,
   then set the wait so the mark lands as the phrase is said.
2. Clicks take time (about 3 seconds in the drawn style), so count them in the waits that follow.

Pitfalls:

1. A disabled button, such as Home on the home page, cannot be clicked: the step times out. Skip it.
2. A selector such as `.symbolEntryToolbar > button:nth-of-type(2)` depends on which buttons
   `public/config.json` shows. Check it again when the config changes.
3. Look for problems in still frames, not only by watching. A contact sheet of frames every 2 seconds shows
   the whole video at once, and frames 0.1 seconds apart show whether a mark draws on or flashes:

   ```bash
   ffmpeg -i videos/output/layout.en.mp4 -vf "fps=1/2,scale=480:-1,tile=4x4" sheet_%02d.png
   ```

   Put the frames outside the repo.

## Add a language

1. Add a Kokoro voice and its pronunciation language to `VOICES` in `lib/Narrate.ts`. The voices are
   listed at <https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md>. Put any word the voice says
   wrong in its `sayAs`, respelt; the captions keep the written word.
2. Add `narration.<lang>.json` and `description.<lang>.txt` to each video, and `assets/credits.<lang>.html`.
3. Record with `--lang <lang>`.
