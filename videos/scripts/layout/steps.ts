/**
 * Welcome and Palette Layout: what the AI in Adaptive Palette does, a tour of the palette's parts, and how to edit
 * a message. Follows docs/design/Welcome and Palette Layout.mp4.
 */
import type { BrowserContext, Page } from "playwright";
import type { Step } from "../../record.ts";
import { arrow, click, drawArrow, highlight } from "../../lib/Highlight.ts";
import { PICTURES, routePictures } from "../../lib/Pictures.ts";

const MESSAGE = "#content-encoding-area";
const BACK = "#command-go-back";
const HOME = "#command-go-to-root";
const SPEAK = "#action-speak";
const MAKE_SENTENCE = "#command-make-sentence";
const PREDICTIONS = "#predicted-words";
const BACKWARD = "#command-move-caret-backwards";
const FORWARD = "#command-move-caret-forwards";
const DELETE = "#command-del-last-encoding";
const DELETE_ALL = "#command-clear-encoding";
// The first and last cells of the edit row. A highlight of both covers the row.
const EDIT_ROW = `${BACKWARD}, #command-clear-saved-data`;
const FOOD = "[data-branchto=\"food\"]";
// The first and last cells of the food page. A highlight of both covers its vocabulary.
const FOOD_VOCABULARY = "[id=\"14377-d2c75912-d868-43ea-be41-fb6ee4d9815e\"], [id=\"25681-d972bb3b-5978-479a-b0e5-b32f61bfc499\"]";
const PICTURE_CELLS = Object.keys(PICTURES).map((id) => `[id="${id}"]`).join(", ");
const WANT = "[id^=\"want-\"]";
const HAMBURGER = "[id^=\"hamburger-\"]";
const BUN = "[id^=\"bun-\"]";
const I = "[id=\"SVG:16161/8497:SVG-5b9bcfeb-5509-4d56-a049-dd92aa0eda6f\"]";
const IN = "[id^=\"in-\"]";
// The symbol at the caret: the one just added.
const CARET_SYMBOL = `${MESSAGE} .cursorCaret`;
const ADD_SYMBOL = ".symbolEntryToolbar > button:nth-of-type(1)";
const SETTINGS = ".symbolEntryToolbar > button:nth-of-type(2)";
const ABOUT_ME = ".symbolEntryToolbar > button:nth-of-type(3)";
const PERSONS = "[data-branchto=\"persons\"]";
const A_AN = "[data-branchto=\"a_an\"]";
// The first words the reference video's suggestion row offers, most used first, and the label each shows.
const OPENERS: [word: string, label: string][] = [
  ["see", "see, look"], ["sandwich", "sandwich"], ["dessert", "dessert"], ["angry", "angry"], ["hungry", "hungry"]
];
const MODULES = {
  gloss: "/src/client/utils/GlossLookupUtils.ts",
  log: "/src/client/core/MessageLog.ts"
};

export const style = "drawn";
// Waits below are where the narration names the next thing, measured from the step's start.

// The home board shows pictures only for the `pictures` step.
let showPictures = false;

/** Route the home board to pictures while `showPictures` is on. */
export async function prepare (context: BrowserContext): Promise<void> {
  await routePictures(context, () => showPictures);
}

/**
 * Before the video starts: save messages that open with `OPENERS`, each one in fewer messages than the one before,
 * so the suggestion row offers them in that order for an empty message. Then reload so the app reads them back.
 */
export async function setup (page: Page): Promise<void> {
  await page.evaluate(async ({ openers, urls }) => {
    type Payload = Record<string, unknown> & { label: string };
    const { resolveWordPayload } = await import(urls.gloss) as {
      resolveWordPayload: (word: string, history: Map<string, Payload>, language: string) => { payload?: Payload }
    };
    const { saveMessageRecord } = await import(urls.log) as { saveMessageRecord: (payloads: Payload[]) => void };
    for (let count = openers.length; count > 0; count--) {
      for (const [word, label] of openers.slice(0, count)) {
        const { payload } = resolveWordPayload(word, new Map(), "en");
        if (!payload) {
          throw new Error(`No Bliss symbol for "${word}"`);
        }
        saveMessageRecord([{ ...payload, label }]);
      }
    }
  }, { openers: OPENERS, urls: MODULES });
  // Saving to storage is not awaited by the app; give it time before the reload reads it back.
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator(".screenPalette").waitFor();
}

/** Turn the pictures on or off and reload. Use only under a card, so the reload is not seen. */
async function reload (page: Page, pictures: boolean): Promise<void> {
  showPictures = pictures;
  await page.reload();
  await page.locator(".screenPalette").waitFor();
}

/** Click each selector in turn. */
async function clickAll (page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    await click(page, selector);
  }
}

/** Build "want hamburger bun" at once, with no pointer, and return home. Use only under a card. */
async function buildMessage (page: Page): Promise<void> {
  for (const selector of [DELETE_ALL, HOME, "[data-branchto=\"to_be\"]", WANT, HOME, FOOD, HAMBURGER, BUN, HOME]) {
    // Home is disabled on the home page.
    const cell = page.locator(selector).first();
    if (await cell.isEnabled()) {
      await cell.click();
    }
  }
}

export const steps: Step[] = [
  { id: "title", chapter: "Welcome", banner: "The Adaptive Palette" },
  { id: "adapts", slide: "adapts.html" },
  { id: "privacy", slide: "privacy.html" },
  {
    id: "overview",
    action: async (page) => {
      await page.waitForTimeout(3500);
      await arrow(page, "#command-indicators", "Bliss strategies");
      await page.waitForTimeout(5000);
      await arrow(page, PREDICTIONS, "Word suggestions");
      await page.waitForTimeout(1300);
      await arrow(page, MAKE_SENTENCE, "Sentence suggestions");
    }
  },
  { id: "benefit-1", slide: "benefits-1.html" },
  { id: "benefit-2", slide: "benefits-2.html" },
  // Under the slide, load the home board with pictures for the next step.
  { id: "benefit-3", slide: "benefits-3.html", action: (page) => reload(page, true) },
  { id: "pictures", highlight: PICTURE_CELLS },

  // Under the card, back to Bliss symbols.
  { id: "layout-title", chapter: "Layout", title: true, action: (page) => reload(page, false) },
  {
    id: "folders",
    // "...such as food" then "...a fold in the top right corner". The box goes as the arrow comes, as in the reference.
    action: async (page) => {
      await page.waitForTimeout(10800);
      await highlight(page, FOOD);
      await page.waitForTimeout(1600);
      await highlight(page);
      await drawArrow(page, FOOD, { corner: true });
    }
  },
  { id: "food", action: (page) => click(page, FOOD) },
  {
    id: "vocabulary",
    // Go home at "...starting at the top", ready for the next step.
    action: async (page) => {
      await highlight(page, FOOD_VOCABULARY);
      await page.waitForTimeout(2500);
      await click(page, HOME);
    }
  },
  {
    id: "top-row",
    // At each button's name.
    action: async (page) => {
      await page.waitForTimeout(1000);
      await arrow(page, ADD_SYMBOL);
      await page.waitForTimeout(1900);
      await arrow(page, SETTINGS);
      await page.waitForTimeout(1100);
      await arrow(page, ABOUT_ME);
    }
  },
  { id: "message", highlight: MESSAGE },
  {
    id: "message-insert",
    action: async (page) => {
      // A box on food, then the click, which removes it. A box drawn by the click would stay over the food page.
      await highlight(page, FOOD);
      await page.waitForTimeout(1000);
      await click(page, FOOD);
      // Click hamburger at "When I click".
      await page.waitForTimeout(7000);
      await click(page, HAMBURGER, { box: true });
      await drawArrow(page, CARET_SYMBOL, { from: HAMBURGER });
    },
    highlight: HAMBURGER
  },
  {
    id: "back-home",
    // The reference cuts to an empty message on the home page here.
    action: async (page) => {
      await page.locator(DELETE_ALL).click();
      await page.locator(HOME).click();
      await highlight(page, BACK);
      await page.waitForTimeout(6000);
    },
    // The runner draws a step's `highlight` after its action, and with none it removes the highlight.
    highlight: HOME
  },
  {
    id: "speak",
    action: async (page) => {
      await highlight(page);  // Clear Home while the narration starts.
      await page.waitForTimeout(3800);
      await highlight(page, SPEAK);
      await page.waitForTimeout(6000);
    },
    highlight: MAKE_SENTENCE
  },
  { id: "predictions", highlight: PREDICTIONS },
  { id: "edit-row", highlight: EDIT_ROW },

  // Under the card, start from "want hamburger bun".
  { id: "edit-title", chapter: "Editing a message", title: true, action: buildMessage },
  { id: "cursor", highlight: `${BACKWARD}, ${FORWARD}` },
  // The words, not the whole window, as in the reference.
  { id: "constructed", highlight: `${MESSAGE} .blissSymbol` },
  // The caret is on "bun". Three steps back puts it before "want".
  { id: "backward", action: async (page) => {
    await arrow(page, BACKWARD);
    await clickAll(page, [BACKWARD, BACKWARD, BACKWARD]);
  } },
  { id: "add-i", action: async (page) => {
    await click(page, PERSONS);
    await click(page, I, { box: true });
  }, highlight: MESSAGE },
  // The caret is on "I". Two steps forward puts it on "hamburger".
  { id: "forward", action: async (page) => {
    await arrow(page, FORWARD);
    await clickAll(page, [FORWARD, FORWARD]);
  } },
  {
    id: "add-in",
    action: async (page) => {
      await clickAll(page, [HOME, A_AN]);
      await click(page, IN, { box: true });
      // The clicks outlast the narration. Hold so "I want hamburger in bun" is seen before the delete.
      await page.waitForTimeout(2500);
    },
    highlight: MESSAGE
  },
  { id: "delete", action: async (page) => {
    await arrow(page, DELETE);
    await click(page, DELETE);
  } },
  { id: "delete-all", action: async (page) => {
    await arrow(page, DELETE_ALL);
    await click(page, DELETE_ALL);
  } },

  { id: "closing-users", chapter: "More videos and credits", slide: "closing.html" },
  { id: "closing-support", slide: "closing.html" },
  { id: "credits", credits: true }
];
