# Feature videos

Short videos that teach people to use Adaptive Palette. Each video is a script, so it can be recorded again
after the UI changes.

## Requirements

1. A Mac. Narration uses the built-in `say` command with the voice "Zoe (Premium)". Download it once:
   System Settings → Accessibility → Spoken Content → System voice → Manage Voices → English (US) →
   Zoe (Premium). You don't need to make it the system voice.
2. ffmpeg and ffprobe. Install them one of two ways:
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

3. Playwright's Chromium, already installed for the tests. If not: `npx playwright install chromium`.

No Ollama is needed. Model replies come from each video's `stubs.json`.

## Record a video

```bash
npm run video -- welcome            # English
npm run video -- welcome --lang en
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

## Publish a video

1. Upload the `.mp4` to YouTube.
2. Add the `.vtt` as subtitles.
3. Paste the description file into the description.
4. Put the YouTube link in the video's `youtube` field in `versions.json`.

## Add a video

1. Create `scripts/<name>/` with `steps.ts`, `narration.en.json`, `description.en.txt` and `stubs.json`. Copy
   `scripts/welcome/`. The runner puts the chapters in place of the `{{chapters}}` line in the description.
2. Each step has an `id`; `narration.<lang>.json` has the text for every id.
3. Give the first step `title: true` to show its narration as a title card, for at least 3 seconds. A
   title step mid-video works as a slide between parts.
4. Give a step a `chapter` to start a YouTube chapter. YouTube needs at least 3 chapters, each at least
   10 seconds long; the runner warns when they are not.
5. List every model that `public/config.json` asks for in `stubs.json` `models`, or the first-run setup
   dialog covers the screen. The runner fails if the app asks Ollama for something with no stub.
6. To show something no shipped palette has, export `prepare(context)` from `steps.ts` and route the
   palette file to a changed copy there. `scripts/welcome/` does this to show a picture.

## Add a language

1. Add a `say` voice for it to `VOICES` in `lib/Narrate.ts`. Download a Premium voice as in
   "Requirements", then find its name with `say -v '?'`.
2. Add `narration.<lang>.json` and `description.<lang>.txt` to each video.
3. Record with `--lang <lang>`.
