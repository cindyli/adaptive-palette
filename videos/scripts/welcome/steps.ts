/**
 * Welcome: an overview. Adaptive Palette supports communication with symbols, and AI on your own computer
 * adapts it to you. A tour of six AI features follows, then the funder credits.
 */
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { Step } from "../../record.ts";
import { click, highlight } from "../../lib/Highlight.ts";

const MESSAGE = "#content-encoding-area";
// The symbol at the caret: the one just added or changed.
const CARET_SYMBOL = `${MESSAGE} .cursorCaret`;
const PREDICTIONS = "#predicted-words";
const HOME = "#command-go-to-root";
const LEARNT = "section[aria-labelledby=\"about-me-learnt-heading\"]";
// No shipped palette has a picture, so the recording shows these home board folders as pictures.
const PICTURES: Record<string, string> = {
  "SVG:12870:SVG-4b3c725a-a3af-48f6-883f-db606886e360": "body.svg",
  "SVG:14377:SVG-9dca58ec-6c54-42c9-a514-2a18a8355df8": "food.svg",
  "drink-973b5970-25c7-402d-bbd0-ce60298025c7": "drink.svg"
};
// No shipped palette has a dog, so the recording puts one in place of the snake in the environment folder.
const SNAKE = "snake-729e6161-8240-430a-be14-1f52b8fb1e7b";
const DOG_ID = "dog-video";
const DOG = `[id="${DOG_ID}"]`;
// The app's modules as the dev server serves them. Importing one in the page gets the app's own copy, so a
// step can change what the UI cannot reach.
const MODULES = {
  state: "/src/client/state/GlobalData.ts",
  messageEdit: "/src/client/core/MessageEdit.ts",
  aboutMe: "/src/client/features/about-me/AboutMeState.ts"
};

type PaletteJson = { cells: Record<string, { type: string, options: Record<string, unknown> }> };

/** For this recording only: show three home board folders as pictures, and put a dog in the environment folder. */
export async function prepare (context: BrowserContext): Promise<void> {
  await context.route("**/palettes/bliss_standard_chart.json", async (route) => {
    const response = await route.fetch();
    const palette = await response.json() as PaletteJson;
    for (const [id, file] of Object.entries(PICTURES)) {
      const options = palette.cells[id].options;
      delete options.composition;
      options.picture = `../pictures/${file}`;
    }
    await route.fulfill({ response, json: palette });
  });
  await context.route("**/palettes/environment.json", async (route) => {
    const response = await route.fetch();
    const palette = await response.json() as PaletteJson;
    const { [SNAKE]: snake, ...cells } = palette.cells;
    cells[DOG_ID] = {
      type: snake.type,
      options: { ...snake.options, label: { en: "dog", sv: "hund" }, composition: 124 }
    };
    await route.fulfill({ response, json: { ...palette, cells } });
  });
  await context.route("**/pictures/*.svg", (route) => route.fulfill({
    path: path.join(import.meta.dirname, path.basename(new URL(route.request().url()).pathname)),
    contentType: "image/svg+xml"
  }));
}

/** Click each selector in turn. */
async function clickAll (page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    await click(page, selector);
  }
}

/** Delete the app's saved data and reload, as someone opening it for the first time sees it. Use only under a
 * title card, so the reload is not seen. */
async function resetApp (page: Page): Promise<void> {
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

/** Give About Me two facts it has learnt, as if the user had accepted the model's suggestions. */
async function learnAboutMe (page: Page): Promise<void> {
  await page.evaluate(async (url) => {
    const { acceptSuggestion } = await import(url) as {
      acceptSuggestion: (fact: { category: string, text: string }) => Promise<void>
    };
    await acceptSuggestion({ category: "Family", text: "has a dog named Rex" });
    await acceptSuggestion({ category: "Communication style", text: "likes short, friendly sentences" });
  }, MODULES.aboutMe);
}

/**
 * Give the word at the caret `label`, marked as the model's. Today the app names a word with modifiers by
 * joining their labels, so this shows what modifier AI will do. Delete it once modifier AI ships.
 */
async function simulateModifierLabel (page: Page, label: string): Promise<void> {
  await page.evaluate(async ({ label, modules }) => {
    type Message = { payloads: Record<string, unknown>[], caretPosition: number };
    const { changeEncodingContents } = await import(modules.state) as { changeEncodingContents: { value: Message } };
    const { editMessage } = await import(modules.messageEdit) as { editMessage: (next: Message) => boolean };
    const { payloads, caretPosition } = changeEncodingContents.value;
    editMessage({
      payloads: payloads.map((payload, index) =>
        index === caretPosition ? { ...payload, label, isAiLabel: true } : payload),
      caretPosition
    });
  }, { label, modules: MODULES });
}

export const steps: Step[] = [
  { id: "title", chapter: "Welcome", title: "Adaptive Palette" },
  { id: "symbols", highlight: ".screenPalette > .actionBranchToPaletteCell" },
  {
    id: "message",
    action: (page) => clickAll(page, ["[data-branchto=\"food\"]", "[id^=\"bread-\"]"]),
    highlight: MESSAGE
  },
  { id: "adapts", title: "AI adapts to you" },
  // Under the card, start again with nothing saved, so the message above is gone.
  { id: "privacy", title: "Private, on your computer", action: resetApp },

  { id: "part-words", chapter: "Say exactly what you mean", title: "Say exactly what you mean" },
  {
    id: "indicator",
    action: (page) => clickAll(page, [
      "[data-branchto=\"man_woman\"]", "[id^=\"child-\"]", "#command-indicators", "#indicator-plural"
    ])
  },
  {
    // From the label table, which a model made in advance.
    id: "indicator-result",
    action: (page) => page.locator(CARET_SYMBOL).getByText("children").waitFor(),
    highlight: CARET_SYMBOL
  },
  { id: "modifier", action: (page) => clickAll(page, ["#command-modifiers", "#modifier-opposite-of"]) },
  {
    id: "modifier-result",
    action: async (page) => {
      await simulateModifierLabel(page, "adults");
      await page.locator(CARET_SYMBOL).getByText("adults").waitFor();
    },
    highlight: CARET_SYMBOL
  },
  {
    id: "compose",
    action: (page) => clickAll(page, [
      "#command-clear-encoding", "#command-new-word",
      HOME, "[data-branchto=\"persons\"]", "[id^=\"16161-\"]",
      HOME, "[data-branchto=\"say_speak\"]", "[id^=\"walk-\"]",
      HOME, "[data-branchto=\"environment\"]", DOG
    ]),
    highlight: MESSAGE
  },
  {
    // Show the model's names while they are read out, then choose one.
    id: "compose-name",
    action: async (page) => {
      await click(page, "#command-done-word");
      await page.locator(".wordNames .aiSuggestion").first().waitFor();
      await highlight(page, ".wordNames");
      await page.waitForTimeout(2500);
      await click(page, ".wordNames .aiSuggestion:has-text(\"dog walker\")");
    },
    highlight: MESSAGE
  },

  {
    id: "part-sentences",
    chapter: "Say it your way",
    title: "Say it your way",
    action: async (page) => {
      await resetApp(page);
      await learnAboutMe(page);
    }
  },
  {
    id: "predict",
    action: async (page) => {
      await clickAll(page, ["[data-branchto=\"environment\"]", DOG]);
      await page.locator(`${PREDICTIONS} .aiSuggestion`).first().waitFor();
    },
    highlight: PREDICTIONS
  },
  {
    id: "sentences",
    action: async (page) => {
      await clickAll(page, [`${PREDICTIONS} button:has-text("walk")`, "#command-make-sentence"]);
      await page.locator(".sentenceChoice").first().waitFor();
    },
    highlight: ".sentenceLayer"
  },
  {
    id: "tone",
    action: (page) => clickAll(page, ["#command-message-attributes", "#attribute-happy"]),
    highlight: "[id^=\"attribute-\"]"
  },
  {
    id: "tone-result",
    action: async (page) => {
      await clickAll(page, ["#command-go-back", "#command-make-sentence"]);
      await page.locator(".sentenceChoice[data-sentence*=\"so happy\"]").waitFor();
    },
    highlight: ".sentenceLayer"
  },
  {
    id: "about-me",
    action: async (page) => {
      await click(page, "#symbolEntryToolbar button:has-text(\"About Me\")");
      await page.locator(LEARNT).scrollIntoViewIfNeeded();
    },
    highlight: LEARNT
  },

  // About Me closes under the card.
  {
    id: "closing",
    chapter: "Credits",
    title: "Your symbols, your words, your way",
    action: (page) => page.keyboard.press("Escape")
  },
  { id: "credits", credits: true }
];
