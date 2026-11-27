/**
 * Shows three home board folders, body, food and drink, as pictures. No shipped palette has a picture, so a video
 * that shows one changes the palette as it loads.
 */
import path from "node:path";
import type { BrowserContext } from "playwright";

/** The home board cells to show as pictures, and the picture for each, in `videos/assets/pictures/`. */
export const PICTURES: Record<string, string> = {
  "SVG:12870:SVG-4b3c725a-a3af-48f6-883f-db606886e360": "body.svg",
  "SVG:14377:SVG-9dca58ec-6c54-42c9-a514-2a18a8355df8": "food.svg",
  "drink-973b5970-25c7-402d-bbd0-ce60298025c7": "drink.svg"
};

const DIR = path.join(import.meta.dirname, "..", "assets", "pictures");

type PaletteJson = { cells: Record<string, { options: Record<string, unknown> }> };

/**
 * Show the `PICTURES` cells as pictures each time the home board loads while `enabled()` is true. Turning it on or
 * off takes effect at the next page load.
 */
export async function routePictures (context: BrowserContext, enabled: () => boolean = () => true): Promise<void> {
  await context.route("**/palettes/bliss_standard_chart.json", async (route) => {
    if (!enabled()) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const palette = await response.json() as PaletteJson;
    for (const [id, file] of Object.entries(PICTURES)) {
      const options = palette.cells[id].options;
      delete options.composition;
      options.picture = `../pictures/${file}`;
    }
    await route.fulfill({ response, json: palette });
  });
  await context.route("**/pictures/*.svg", (route) => route.fulfill({
    path: path.join(DIR, path.basename(new URL(route.request().url()).pathname)),
    contentType: "image/svg+xml"
  }));
}
