/**
 * Welcome: what AI does in the palette, then the screen layout. The trial video.
 */
import path from "node:path";
import type { BrowserContext } from "playwright";
import type { Step } from "../../record.ts";
import { click } from "../../lib/Highlight.ts";

const MESSAGE = "#content-encoding-area";
// No shipped palette has a picture, so the recording shows these home board folders as pictures. They sit
// side by side, so one highlight box covers just them.
const PICTURES: Record<string, string> = {
  "SVG:12870:SVG-4b3c725a-a3af-48f6-883f-db606886e360": "body.svg",
  "SVG:14377:SVG-9dca58ec-6c54-42c9-a514-2a18a8355df8": "food.svg",
  "drink-973b5970-25c7-402d-bbd0-ce60298025c7": "drink.svg"
};

/** Show the home board's body, food and drink folders as pictures, for this recording only. */
export async function prepare (context: BrowserContext): Promise<void> {
  await context.route("**/palettes/bliss_standard_chart.json", async (route) => {
    const response = await route.fetch();
    const palette = await response.json() as { cells: Record<string, { options: Record<string, unknown> }> };
    for (const [id, file] of Object.entries(PICTURES)) {
      const options = palette.cells[id].options;
      delete options.composition;
      options.picture = `../pictures/${file}`;
    }
    await route.fulfill({ response, json: palette });
  });
  await context.route("**/pictures/*.svg", (route) => route.fulfill({
    path: path.join(import.meta.dirname, path.basename(new URL(route.request().url()).pathname)),
    contentType: "image/svg+xml"
  }));
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
  {
    // Under the title card, start the app again as someone opening it for the first time sees it. The
    // preview saved its message, which would show up as a word suggestion.
    id: "privacy",
    title: "Your messages stay private",
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
    }
  },
  { id: "welcome" },
  { id: "input-area", highlight: MESSAGE },
  { id: "symbol-grid", highlight: ".screenPalette > .actionBranchToPaletteCell" },
  { id: "customize", highlight: Object.keys(PICTURES).map((id) => `[id="${id}"]`).join(", ") },
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
