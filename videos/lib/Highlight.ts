/**
 * Draws on the page being recorded: a title card, an outline around the area being explained with the rest of the
 * screen dimmed, a pointer that shows each click, arrows, and a banner title strip. Nothing flashes or pulses. The
 * outline is magenta, a colour the app does not use, and the pointer is a white ring edged in black, so both stand
 * out on any image or text. In the "drawn" style, red boxes and arrows draw themselves on instead, and the pointer
 * stays on screen and glides from click to click. All of it sits in the browser's top layer, so it shows above an open
 * dialog too.
 */
import type { BrowserContext, Page } from "playwright";

const POINTER_MOVE_MS = 800;
// After a click, so its result can be seen before the pointer moves on.
const CLICK_HOLD_MS = 1000;
const HIGHLIGHT_MOVE_MS = 400;
// A title card fades in and out over this time.
const CARD_FADE_MS = 400;
const TARGET_TIMEOUT_MS = 5000;
// The strip a banner title takes at the top of the screen.
const BANNER_HEIGHT = 80;
// The drawn style: a box or arrow draws on over this time.
const DRAW_MS = 600;
// The drawn style: the pointer rests on a target this long before clicking, and the result is held this long after.
const DWELL_MS = 600;
const DRAWN_CLICK_HOLD_MS = 1500;

/** The overlay's look: the default outline and ring, or "drawn" red boxes and arrows with a pointer that stays. */
export type OverlayStyle = "drawn";

// Set by `installOverlay`. One process records one video, so one value serves every page.
let drawn = false;

type Box = { left: number, top: number, right: number, bottom: number };

const OVERLAY_CSS = `
  #videoHighlight, #videoPointer, #videoTitle, #videoBanner, #videoDraw, .videoArrow {
    position: fixed; pointer-events: none; z-index: 2147483647;
    /* Undo the browser's popover style. */
    inset: auto; width: auto; height: auto; margin: 0; padding: 0; border: 0; overflow: visible; background: none;
  }
  #videoTitle {
    display: none; inset: 0; align-items: center; justify-content: center; padding: 0 10%;
    background: #13706b; color: #fff; font: bold 56px/1.3 sans-serif; text-align: center;
    animation: videoFadeIn ${CARD_FADE_MS}ms ease;
  }
  #videoTitle.videoCard {
    flex-direction: column; background: #fff; color: #1a1a1a; font: 600 30px/1.4 sans-serif;
  }
  @keyframes videoFadeIn { from { opacity: 0; } }
  @keyframes videoFadeOut { to { opacity: 0; } }
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
  #videoBanner {
    display: none; top: 0; left: 0; right: 0; height: ${BANNER_HEIGHT}px; align-items: center; justify-content: center;
    background: #13706b; color: #fff; font: bold 48px/1 sans-serif;
  }
  .videoArrow { color: #ff1493; }
  /* A label shaped as an arrow pointing right. */
  .videoArrowLabel {
    display: flex; align-items: center; height: 56px; padding: 0 64px 0 32px; border-radius: 28px 0 0 28px;
    background: #ff1493; color: #fff; font: bold 28px/1 sans-serif; white-space: nowrap;
    clip-path: polygon(0 0, calc(100% - 40px) 0, 100% 50%, calc(100% - 40px) 100%, 0 100%);
  }
  /* The drawn style's layer: boxes and arrows are SVG paths, drawn on with stroke-dashoffset. */
  #videoDraw { inset: 0; color: #ff1493; }
  #videoDraw svg { position: fixed; inset: 0; width: 100vw; height: 100vh; overflow: visible; }
  .videoStroke {
    fill: none; stroke: currentColor; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 1; animation: videoDrawOn ${DRAW_MS}ms ease-out forwards;
  }
  @keyframes videoDrawOn { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
`;

/**
 * Add the title card, highlight, pointer, banner and drawing layer to every page the context opens, before the page
 * is drawn. A page reloaded under a card shows the card again at once, so the reload is never seen.
 * @param themeCss - A video's own styles, added after the overlay's, such as its `theme.css`.
 * @param style - "drawn" for hand-drawn red boxes and arrows, and a pointer that glides from click to click.
 */
export async function installOverlay (context: BrowserContext, themeCss = "", style?: OverlayStyle): Promise<void> {
  drawn = style === "drawn";
  await context.addInitScript((css) => {
    const add = (): void => {
      const styleElement = document.createElement("style");
      styleElement.textContent = css;
      document.documentElement.append(styleElement);
      for (const id of ["videoHighlight", "videoPointer", "videoTitle", "videoBanner", "videoDraw"]) {
        const element = document.createElement("div");
        element.id = id;
        if (id === "videoDraw") {
          element.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
        }
        // In the top layer, so it shows above a dialog. Each one is shown again each time it is drawn, which puts it
        // above any dialog opened since.
        element.popover = "manual";
        document.documentElement.append(element);
        element.showPopover();
      }
      const title = sessionStorage.getItem("videoTitle");
      const cardHtml = sessionStorage.getItem("videoCard");
      if (title !== null || cardHtml !== null) {
        const card = document.getElementById("videoTitle")!;
        if (cardHtml !== null) {
          card.innerHTML = cardHtml;
          card.classList.add("videoCard");
        } else {
          card.textContent = title;
        }
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
  }, OVERLAY_CSS + themeCss);
}

/**
 * Remove the pointer and any arrows, and fade out the title card. The highlight stays until it moves or is removed.
 * With `keepCard`, the card stays for the next one to replace, so the app does not show between two cards.
 */
export async function clearOverlay (page: Page, keepCard = false): Promise<void> {
  const fading = await page.evaluate(({ keep, fadeMs, isDrawn }) => {
    // The drawn style's pointer stays on screen, so each click glides from where the last one was.
    if (!isDrawn) {
      document.getElementById("videoPointer")!.style.display = "none";
    }
    document.querySelectorAll(".videoArrow, .videoArrowPath").forEach((arrow) => arrow.remove());
    const card = document.getElementById("videoTitle")!;
    if (keep || card.style.display !== "flex") {
      return false;
    }
    sessionStorage.removeItem("videoTitle");
    sessionStorage.removeItem("videoCard");
    card.style.animation = `videoFadeOut ${fadeMs}ms ease forwards`;
    return true;
  }, { keep: keepCard, fadeMs: CARD_FADE_MS, isDrawn: drawn });
  if (fading) {
    await page.waitForTimeout(CARD_FADE_MS);
    await page.evaluate(() => {
      const card = document.getElementById("videoTitle")!;
      card.style.display = "none";
      // So the next card fades in. A card shown at once, or after a reload, has `animation: none`.
      card.style.animation = "";
    });
  }
}

/** Cover the screen with `text` as a title card, without a trailing period. Without `fadeIn`, it shows at once. */
export async function showTitle (page: Page, text: string, fadeIn = true): Promise<void> {
  await page.evaluate(({ title, fade }) => {
    const card = document.getElementById("videoTitle")!;
    card.textContent = title.replace(/\.$/, "");
    card.classList.remove("videoCard");
    sessionStorage.setItem("videoTitle", card.textContent);
    sessionStorage.removeItem("videoCard");
    card.hidePopover();
    card.showPopover();
    if (!fade) {
      card.style.animation = "none";
    }
    card.style.display = "flex";
  }, { title: text, fade: fadeIn });
}

/** Cover the screen with `html` on a white card, such as the funder credits, once its images have loaded. */
export async function showCard (page: Page, html: string): Promise<void> {
  await page.evaluate(async (content) => {
    // Load the images before the card changes. A missing image fails the step here, rather than showing a broken one.
    const holder = document.createElement("div");
    holder.innerHTML = content;
    await Promise.all([...holder.querySelectorAll("img")].map((image) => image.decode()
      .catch(() => { throw new Error(`Cannot load ${image.getAttribute("src")}`); })));
    const card = document.getElementById("videoTitle")!;
    card.replaceChildren(...holder.childNodes);
    card.classList.add("videoCard");
    // So a reload under the card shows it again.
    sessionStorage.setItem("videoCard", content);
    sessionStorage.removeItem("videoTitle");
    card.hidePopover();
    card.showPopover();
    card.style.display = "flex";
  }, html);
}

/** Wait for `selector` to be visible; the error names the selector so the runner can name the step. */
async function waitForTarget (page: Page, selector: string): Promise<void> {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: TARGET_TIMEOUT_MS });
  } catch {
    throw new Error(`no visible element matches ${selector}`);
  }
}

/** The box around every visible match of `selector`, or none. A hidden match has an empty rect at 0,0. */
async function boxAround (page: Page, selector: string): Promise<Box | undefined> {
  return page.evaluate((target) => {
    const rects = [...document.querySelectorAll(target)]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) {
      return undefined;
    }
    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom))
    };
  }, selector);
}

/** The box of the first visible match of `selector`. Call `waitForTarget` first. */
async function firstBox (page: Page, selector: string): Promise<Box> {
  return page.evaluate((target) => {
    const rect = [...document.querySelectorAll(target)]
      .map((element) => element.getBoundingClientRect())
      .find((box) => box.width > 0 && box.height > 0)!;
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }, selector);
}

/** A rectangle path just outside `box`. */
function boxPath ({ left, top, right, bottom }: Box): string {
  const pad = 4;
  return `M${left - pad} ${top - pad}H${right + pad}V${bottom + pad}H${left - pad}Z`;
}

/**
 * Add path `d` to the drawing layer with class `kind`, and wait while it draws on. `key` names what it marks, so a
 * box already drawn there can be kept. A card showing stays on top.
 */
async function drawPath (page: Page, d: string, kind: string, key = ""): Promise<void> {
  await page.evaluate(({ path, cls, id }) => {
    const layer = document.getElementById("videoDraw")!;
    layer.hidePopover();
    layer.showPopover();
    const card = document.getElementById("videoTitle")!;
    if (card.style.display === "flex") {
      card.hidePopover();
      card.showPopover();
    }
    const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
    element.setAttribute("d", path);
    element.setAttribute("pathLength", "1");
    element.setAttribute("class", `videoStroke ${cls}`);
    element.dataset.key = id;
    layer.querySelector("svg")!.append(element);
  }, { path: d, cls: kind, id: key });
  await page.waitForTimeout(DRAW_MS);
}

/**
 * The drawn style's highlight: draw a box around everything `selector` matches. A box already around `selector`
 * stays; any other is removed. Nothing is drawn under a card, so the box is seen drawing on after the card goes.
 */
async function drawBox (page: Page, selector?: string): Promise<void> {
  const kept = await page.evaluate((key) => {
    const old = [...document.querySelectorAll<SVGElement>(".videoBox")];
    if (old.length === 1 && old[0].dataset.key === key) {
      return true;
    }
    old.forEach((element) => element.remove());
    return document.getElementById("videoTitle")!.style.display === "flex";
  }, selector ?? "");
  const box = selector && !kept ? await boxAround(page, selector) : undefined;
  if (box) {
    await drawPath(page, boxPath(box), "videoBox", selector);
  }
}

/**
 * Outline everything `selector` matches, as one box, and dim the rest. A box already showing moves there.
 * No selector removes the highlight. A highlight hides the pointer, and a click hides the highlight, so
 * there is one place to look. In the drawn style, a red box draws on around the target instead, with no dimming, and
 * the pointer stays.
 */
export async function highlight (page: Page, selector?: string): Promise<void> {
  if (selector) {
    await waitForTarget(page, selector);
  }
  if (drawn) {
    await drawBox(page, selector);
    return;
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
    // Every time, so it stays above a dialog opened since it was last drawn.
    box.hidePopover();
    box.showPopover();
    // A card still showing stays on top, so the highlight is drawn under it.
    const card = document.getElementById("videoTitle")!;
    if (card.style.display === "flex") {
      card.hidePopover();
      card.showPopover();
    }
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

/**
 * Show the pointer on the first match of `selector`, click it, then hold so the result can be seen. A pointer already
 * showing moves there. In the drawn style the pointer stays on screen and glides in from below the
 * screen when first shown, rests on the target before clicking, and holds longer after; with `box`, a red box
 * draws on around the target before the click.
 */
export async function click (page: Page, selector: string, { box = false }: { box?: boolean } = {}): Promise<void> {
  await waitForTarget(page, selector);
  const target = page.locator(selector).first();
  const rect = (await target.boundingBox())!;
  await page.evaluate(({ x, y, isDrawn }) => {
    document.getElementById("videoHighlight")!.style.display = "none";
    document.querySelectorAll(".videoBox").forEach((element) => element.remove());
    const pointer = document.getElementById("videoPointer")!;
    const appearing = pointer.style.display !== "block";
    // Every time, so it stays above a dialog opened since it was last drawn.
    pointer.hidePopover();
    pointer.showPopover();
    if (appearing) {
      pointer.style.transition = "none";
      if (isDrawn) {
        // Start just below the screen and glide in, so it never appears from nowhere.
        Object.assign(pointer.style, { left: `${innerWidth / 2}px`, top: `${innerHeight + 20}px`, display: "block" });
      } else {
        Object.assign(pointer.style, { left: `${x}px`, top: `${y}px` });
      }
      pointer.getBoundingClientRect();  // Place it before turning the move transition back on.
      pointer.style.transition = "";
      pointer.style.display = "block";
    }
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
  }, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, isDrawn: drawn });
  await page.waitForTimeout(POINTER_MOVE_MS + 100);
  if (drawn) {
    await page.waitForTimeout(DWELL_MS);
    if (box) {
      await drawPath(page, boxPath(await firstBox(page, selector)), "videoBox", selector);
    }
  }
  await target.click();
  await page.waitForTimeout(drawn ? DRAWN_CLICK_HOLD_MS : CLICK_HOLD_MS);
}

/**
 * Show `text` as a strip across the top of the screen, with the app shrunk to fit below it. `zoom` lays the app out
 * again at the smaller size, so its text stays sharp, where a transform would scale its pixels. A step's banner stays
 * until the next step starts.
 */
export async function showBanner (page: Page, text: string): Promise<void> {
  await page.evaluate(({ title, height }) => {
    const banner = document.getElementById("videoBanner")!;
    banner.textContent = title;
    banner.style.display = "flex";
    const zoom = (innerHeight - height) / innerHeight;
    document.documentElement.style.paddingTop = `${height}px`;
    // The height is in the body's zoomed px, so on screen it is the space below the strip.
    Object.assign(document.body.style, { zoom: String(zoom), height: `${(innerHeight - height) / zoom}px` });
  }, { title: text, height: BANNER_HEIGHT });
}

/** Remove the banner and return the app to full size. */
export async function hideBanner (page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById("videoBanner")!.style.display = "none";
    document.documentElement.style.paddingTop = "";
    Object.assign(document.body.style, { zoom: "", height: "" });
  });
}

/**
 * Point an arrow at the first visible match of `selector`. With `label`, the label is shaped as an arrow coming from
 * the left, its tip at the middle of the target. Without, a plain arrow points up at the target from below. Arrows
 * stay until the next step clears the overlay, and several can show at once. In the drawn style, a plain arrow draws on.
 */
export async function arrow (page: Page, selector: string, label?: string): Promise<void> {
  await waitForTarget(page, selector);
  if (drawn && !label) {
    const box = await firstBox(page, selector);
    const x = (box.left + box.right) / 2;
    const y = box.bottom + 6;
    // One continuous line, shaft then head, so it draws on in one stroke.
    await drawPath(page, `M${x} ${y + 90}V${y}l-14 16l14 -16l14 16`, "videoArrowPath");
    return;
  }
  await page.evaluate(({ target, text }) => {
    const rect = [...document.querySelectorAll(target)]
      .map((element) => element.getBoundingClientRect())
      .find((box) => box.width > 0 && box.height > 0)!;
    const element = document.createElement("div");
    element.className = "videoArrow";
    element.popover = "manual";
    if (text) {
      element.classList.add("videoArrowLabel");
      element.textContent = text;
      Object.assign(element.style, {
        right: `${Math.max(0, innerWidth - (rect.left + rect.width / 2))}px`,
        top: `${rect.top + rect.height / 2 - 28}px`
      });
    } else {
      element.innerHTML = "<svg width=\"40\" height=\"90\" viewBox=\"0 0 40 90\"><path d=\"M20 4V86M6 20L20 4L34 20\" " +
        "fill=\"none\" stroke=\"currentColor\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
      Object.assign(element.style, { left: `${rect.left + rect.width / 2 - 20}px`, top: `${rect.bottom + 4}px` });
    }
    document.documentElement.append(element);
    element.showPopover();
  }, { target: selector, text: label });
}

/**
 * Draw a curved red arrow on, ending at `to`: at its top right corner with `corner` (a folder's fold), otherwise below
 * its middle. With `from`, it starts at the top of `from`; otherwise just below and right of its end. It stays until
 * the next step clears the overlay.
 */
export async function drawArrow (
  page: Page, to: string, { from, corner = false }: { from?: string, corner?: boolean } = {}
): Promise<void> {
  await waitForTarget(page, to);
  const end = await firstBox(page, to);
  const [ex, ey] = corner ? [end.right - 8, end.top + 8] : [(end.left + end.right) / 2, end.bottom + 4];
  let [sx, sy] = [ex + 50, ey + 60];
  if (from) {
    await waitForTarget(page, from);
    const start = await firstBox(page, from);
    [sx, sy] = [(start.left + start.right) / 2, start.top - 4];
  }
  // Bend to one side by a fifth of the arrow's length.
  const [cx, cy] = [(sx + ex) / 2 - (ey - sy) * 0.2, (sy + ey) / 2 + (ex - sx) * 0.2];
  // Two barbs 16px long, about 30 degrees either side of the direction the curve arrives in.
  const angle = Math.atan2(ey - cy, ex - cx);
  const barb = (turn: number): string => `${ex - 16 * Math.cos(angle + turn)} ${ey - 16 * Math.sin(angle + turn)}`;
  await drawPath(page, `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}L${barb(0.5)}L${ex} ${ey}L${barb(-0.5)}`, "videoArrowPath");
}
