/**
 * Welcome: what AI does in the palette, then the screen layout. The trial video.
 */
import path from "node:path";
import type { BrowserContext } from "playwright";
import type { Step } from "../../record.ts";
import { click, installOverlay } from "../../lib/Highlight.ts";

const MESSAGE = "#content-encoding-area";
// No shipped palette has a picture, so the recording shows the egg as one.
const EGG_CELL = "13912-a113a7c7-2c86-4a23-815c-82c09a484e13";

/** Show the food palette's egg as a picture, for this recording only. */
export async function prepare (context: BrowserContext): Promise<void> {
  await context.route("**/palettes/food.json", async (route) => {
    const response = await route.fetch();
    const palette = await response.json() as { cells: Record<string, { options: Record<string, unknown> }> };
    const egg = palette.cells[EGG_CELL].options;
    delete egg.composition;
    egg.picture = "../pictures/egg.svg";
    await route.fulfill({ response, json: palette });
  });
  await context.route("**/pictures/egg.svg", (route) =>
    route.fulfill({ path: path.join(import.meta.dirname, "egg.svg"), contentType: "image/svg+xml" })
  );
}

export const steps: Step[] = [
  { id: "title", chapter: "Welcome", title: true },
  {
    // A preview of what AI does, before the tour shows how.
    id: "ai-preview",
    action: async (page) => {
      for (const target of ["[data-branchto=\"food\"]", "[id^=\"bread-\"]", "[id^=\"cookie-\"]",
        "#command-go-back", "#command-make-sentence"]) {
        await click(page, target);
      }
    },
    highlight: ".sentenceLayer"
  },
  { id: "privacy", highlight: ".sentenceLayer" },
  {
    // Start the tour as someone opening the app for the first time sees it. The preview saved its
    // message, which would show up as a word suggestion.
    id: "welcome",
    action: async (page) => {
      await page.evaluate(async () => {
        for (const { name } of await indexedDB.databases()) {
          if (name) {
            indexedDB.deleteDatabase(name);
          }
        }
      });
      await page.reload();
      await page.locator(".screenPalette").waitFor();
      await installOverlay(page);
    }
  },
  { id: "input-area", highlight: MESSAGE },
  { id: "symbol-grid", highlight: ".screenPalette > .actionBranchToPaletteCell" },
  {
    id: "open-food",
    chapter: "Building a message",
    action: (page) => click(page, "[data-branchto=\"food\"]")
  },
  {
    id: "add-symbols",
    action: async (page) => {
      await click(page, "[id^=\"bread-\"]");
      await click(page, "[id^=\"cookie-\"]");
    },
    highlight: MESSAGE
  },
  { id: "pictures", highlight: `[id="${EGG_CELL}"]` },
  { id: "word-predictions", highlight: "#predicted-words" },
  { id: "command-bar", highlight: "[data-palettename=\"Command Bar\"]" },
  { id: "go-back", action: (page) => click(page, "#command-go-back"), highlight: "#command-go-back" },
  { id: "sentences-slide", chapter: "Sentences", title: true },
  {
    id: "make-sentences",
    action: (page) => click(page, "#command-make-sentence"),
    highlight: ".sentenceLayer"
  },
  { id: "next-steps", action: (page) => click(page, ".sentenceDone") }
];
