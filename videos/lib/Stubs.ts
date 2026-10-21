/**
 * Answers the app's Ollama requests with fixed replies, so every recording is the same and needs no
 * local model.
 */
import type { BrowserContext } from "playwright";

/** The contents of a video's `stubs.json`. */
export interface StubFile {
  /** Model names `/api/tags` lists. Must include every model `public/config.json` asks for. */
  models: string[];
  /** The first entry whose `match` appears in a chat request's body gives the reply. */
  chat: { match: string; reply: string }[];
}

const OLLAMA = "http://127.0.0.1:11434/**";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

/**
 * Route every Ollama request in `context` to `stubs`.
 * @returns A list that collects a description of each request no stub answered. The runner fails the
 *          recording when it is not empty.
 */
export async function installStubs (context: BrowserContext, stubs: StubFile): Promise<string[]> {
  const unanswered: string[] = [];
  await context.route(OLLAMA, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (path === "/api/tags") {
      await route.fulfill({ headers: CORS, json: { models: stubs.models.map((name) => ({ name, model: name })) } });
      return;
    }
    const body = request.postData() ?? "";
    const stub = path === "/api/chat" ? stubs.chat.find((entry) => body.includes(entry.match)) : undefined;
    if (!stub) {
      unanswered.push(`${request.method()} ${path} ${body.slice(0, 200)}`);
      await route.fulfill({ status: 500, headers: CORS, body: "No stub for this request" });
      return;
    }
    const model = (JSON.parse(body) as { model: string }).model;
    await route.fulfill({
      headers: CORS,
      json: {
        model,
        created_at: "2026-01-01T00:00:00Z",
        message: { role: "assistant", content: stub.reply },
        done: true
      }
    });
  });
  return unanswered;
}
