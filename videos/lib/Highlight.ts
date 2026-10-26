/**
 * Draws on the page being recorded: a title card, an outline around the area being explained with the
 * rest of the screen dimmed, and a pointer that shows each click. Nothing flashes or pulses. The outline is
 * magenta, a colour the app does not use, and the pointer is a white ring edged in black, so both stand out
 * on any image or text.
 */
import type { BrowserContext, Page } from "playwright";

const POINTER_MOVE_MS = 600;
const HIGHLIGHT_MOVE_MS = 400;
const TARGET_TIMEOUT_MS = 5000;

const OVERLAY_CSS = `
  #videoHighlight, #videoPointer, #videoTitle { position: fixed; pointer-events: none; z-index: 2147483647; }
  #videoTitle {
    display: none; inset: 0; align-items: center; justify-content: center; padding: 0 10%;
    background: #13706b; color: #fff; font: bold 56px/1.3 sans-serif; text-align: center;
    animation: videoFadeIn 400ms ease;
  }
  @keyframes videoFadeIn { from { opacity: 0; } }
  #videoHighlight {
    display: none; border-radius: 6px; outline: 8px solid #ff1493; outline-offset: 2px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
    transition: left ${HIGHLIGHT_MOVE_MS}ms ease, top ${HIGHLIGHT_MOVE_MS}ms ease,
      width ${HIGHLIGHT_MOVE_MS}ms ease, height ${HIGHLIGHT_MOVE_MS}ms ease;
  }
  #videoPointer {
    display: none; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
    background: rgba(255, 0, 140, 0.35); border: 6px solid #fff;
    box-shadow: 0 0 0 3px #000, inset 0 0 0 3px #000;
    transition: left ${POINTER_MOVE_MS}ms ease, top ${POINTER_MOVE_MS}ms ease;
  }
`;

/**
 * Add the title card, highlight and pointer to every page the context opens, before the page is drawn. A page
 * reloaded under a title card shows the card again at once, so the reload is never seen.
 */
export async function installOverlay (context: BrowserContext): Promise<void> {
  await context.addInitScript((css) => {
    const add = (): void => {
      const style = document.createElement("style");
      style.textContent = css;
      document.documentElement.append(style);
      for (const id of ["videoHighlight", "videoPointer", "videoTitle"]) {
        const element = document.createElement("div");
        element.id = id;
        document.documentElement.append(element);
      }
      const title = sessionStorage.getItem("videoTitle");
      if (title !== null) {
        const card = document.getElementById("videoTitle")!;
        card.textContent = title;
        Object.assign(card.style, { display: "flex", animation: "none" });
      }
    };
    if (document.documentElement) {
      add();
    } else {
      new MutationObserver((_, observer) => {
        if (document.documentElement) {
          observer.disconnect();
          add();
        }
      }).observe(document, { childList: true });
    }
  }, OVERLAY_CSS);
}

/** Remove the title card and pointer, ready for the next step. The highlight stays until it moves or is removed. */
export async function clearOverlay (page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.removeItem("videoTitle");
    for (const id of ["videoPointer", "videoTitle"]) {
      document.getElementById(id)!.style.display = "none";
    }
  });
}

/** Cover the screen with `text` as a title card, without a trailing period. */
export async function showTitle (page: Page, text: string): Promise<void> {
  await page.evaluate((title) => {
    const card = document.getElementById("videoTitle")!;
    card.textContent = title.replace(/\.$/, "");
    sessionStorage.setItem("videoTitle", card.textContent);
    card.style.display = "flex";
  }, text);
}

/** Wait for `selector` to be visible; the error names the selector so the runner can name the step. */
async function waitForTarget (page: Page, selector: string): Promise<void> {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: TARGET_TIMEOUT_MS });
  } catch {
    throw new Error(`no visible element matches ${selector}`);
  }
}

/**
 * Outline everything `selector` matches, as one box, and dim the rest. A box already showing moves there.
 * No selector removes the highlight. A highlight hides the pointer, and a click hides the highlight, so
 * there is one place to look.
 */
export async function highlight (page: Page, selector?: string): Promise<void> {
  if (selector) {
    await waitForTarget(page, selector);
  }
  await page.evaluate((target) => {
    const box = document.getElementById("videoHighlight")!;
    // A hidden match has an empty rect at 0,0, which would stretch the box to the corner.
    const rects = target
      ? [...document.querySelectorAll(target)]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
      : [];
    if (rects.length === 0) {
      box.style.display = "none";
      return;
    }
    document.getElementById("videoPointer")!.style.display = "none";
    const appearing = box.style.display !== "block";
    if (appearing) {
      box.style.transition = "none";
    }
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    Object.assign(box.style, {
      display: "block",
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(...rects.map((rect) => rect.right)) - left}px`,
      height: `${Math.max(...rects.map((rect) => rect.bottom)) - top}px`
    });
    if (appearing) {
      box.getBoundingClientRect();  // Place it before turning the move transition back on.
      box.style.transition = "";
    }
  }, selector);
}

/** Show the pointer on the first match of `selector`, then click it. A pointer already showing moves there. */
export async function click (page: Page, selector: string): Promise<void> {
  await waitForTarget(page, selector);
  const target = page.locator(selector).first();
  const rect = (await target.boundingBox())!;
  await page.evaluate(({ x, y }) => {
    document.getElementById("videoHighlight")!.style.display = "none";
    const pointer = document.getElementById("videoPointer")!;
    const appearing = pointer.style.display !== "block";
    if (appearing) {
      pointer.style.transition = "none";
    }
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    if (appearing) {
      pointer.getBoundingClientRect();  // Place it before turning the move transition back on.
      pointer.style.transition = "";
      pointer.style.display = "block";
    }
  }, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  await page.waitForTimeout(POINTER_MOVE_MS + 100);
  await target.click();
}
