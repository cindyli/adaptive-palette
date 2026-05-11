/*
 * Copyright 2026 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/inclusive-design/adaptive-palette/blob/main/LICENSE
 */

import { adaptivePaletteGlobals } from "./GlobalData";
import { queryChat } from "./ollamaApi";
import {
  __resetCanonicalCache,
  buildProcessorContext,
  buildSystemPrompt,
  buildUserPrompt,
  interpretBlissWord
} from "./blissWordProcessor";

jest.mock("./ollamaApi", () => ({
  queryChat: jest.fn()
}));

const mockedQueryChat = jest.mocked(queryChat);

// Synthetic dictionary covering every code path:
// - 100/200/300: plain characters (no composition).
// - 8993, 9004: real indicators (in INDICATOR_SEMANTICS).
// - 15972: real prefix-only modifier (in MODIFIER_SEMANTICS).
// - 8497: real both-prefix-and-suffix modifier (or-branch entry).
// - 9000: composition resolves to canonical [100, 200].
// - 9001: composition with `;` indicator marker; resolves to canonical [100, 200].
// - 9002: composition resolves to canonical [100, 200, 300].
const FAKE_SYMBOLS = [
  { id: "100", description: "alpha", explanation: "exp-100", isCharacter: true },
  { id: "200", description: "beta", explanation: "exp-200", isCharacter: true },
  { id: "300", description: "gamma", explanation: "exp-300", isCharacter: true },
  { id: "8993", description: "infinitive-indicator", explanation: "ind", isCharacter: true },
  { id: "9004", description: "past-tense-indicator", explanation: "ind", isCharacter: true },
  { id: "15972", description: "part-of-modifier", explanation: "mod", isCharacter: true },
  { id: "8497", description: "first-person-or-one", explanation: "mod", isCharacter: true },
  { id: "9000", description: "alpha-beta-compound", composition: [100, "/", 200] },
  { id: "9001", description: "alpha-with-indicator-beta", composition: [100, ";", 8993, "/", 200] },
  { id: "9002", description: "alpha-beta-gamma-compound", composition: [100, "/", 200, "/", 300] }
];

type Mutable = { bciAvSymbols: unknown; LLMs: string[] };

const original = {
  bciAvSymbols: adaptivePaletteGlobals.bciAvSymbols,
  LLMs: adaptivePaletteGlobals.LLMs
};

beforeEach(() => {
  (adaptivePaletteGlobals as unknown as Mutable).bciAvSymbols = FAKE_SYMBOLS;
  adaptivePaletteGlobals.LLMs = ["test-model"];
  __resetCanonicalCache();
  mockedQueryChat.mockReset();
});

afterAll(() => {
  (adaptivePaletteGlobals as unknown as Mutable).bciAvSymbols = original.bciAvSymbols;
  adaptivePaletteGlobals.LLMs = original.LLMs;
  __resetCanonicalCache();
});

describe("buildProcessorContext", () => {
  test("empty input returns empty arrays and empty effects", () => {
    const ctx = buildProcessorContext([]);
    expect(ctx).toEqual({
      inputIds: [],
      annotations: [],
      indicatorEffects: {},
      subSequenceMatches: []
    });
  });

  test("single ID has position 'only' and gloss attached", () => {
    const ctx = buildProcessorContext(["100"]);
    expect(ctx.annotations).toHaveLength(1);
    expect(ctx.annotations[0]).toMatchObject({
      id: "100",
      position: "only",
      gloss: "alpha",
      explanation: "exp-100",
      isCharacter: true
    });
    expect(ctx.annotations[0].indicator).toBeUndefined();
    expect(ctx.annotations[0].modifier).toBeUndefined();
  });

  test("prefix-only modifier at first: emitted, not ambiguous", () => {
    const ctx = buildProcessorContext(["15972", "100", "200"]);
    expect(ctx.annotations[0].modifier).toBeDefined();
    expect(ctx.annotations[0].modifier?.roleAmbiguous).toBe(false);
  });

  test("prefix-only modifier at last: modifier annotation skipped", () => {
    const ctx = buildProcessorContext(["100", "200", "15972"]);
    expect(ctx.annotations[2].id).toBe("15972");
    expect(ctx.annotations[2].modifier).toBeUndefined();
  });

  test("prefix-only modifier at middle: emitted, not ambiguous", () => {
    const ctx = buildProcessorContext(["100", "15972", "200"]);
    expect(ctx.annotations[1].modifier).toBeDefined();
    expect(ctx.annotations[1].modifier?.roleAmbiguous).toBe(false);
  });

  test("dual-role modifier (or-branch) at middle: roleAmbiguous true", () => {
    const ctx = buildProcessorContext(["100", "8497", "200"]);
    expect(ctx.annotations[1].modifier).toBeDefined();
    expect(ctx.annotations[1].modifier?.roleAmbiguous).toBe(true);
  });

  test("dual-role modifier at first: not ambiguous (prefix branch only)", () => {
    const ctx = buildProcessorContext(["8497", "100", "200"]);
    expect(ctx.annotations[0].modifier?.roleAmbiguous).toBe(false);
  });

  test("dual-role modifier at last: not ambiguous (suffix branch only)", () => {
    const ctx = buildProcessorContext(["100", "200", "8497"]);
    expect(ctx.annotations[2].modifier?.roleAmbiguous).toBe(false);
  });

  test("multiple indicators merge with last-wins on conflicting features", () => {
    const ctx = buildProcessorContext(["100", "8993", "9004"]);
    expect(ctx.indicatorEffects.POS).toBe("verb");
    const features = ctx.indicatorEffects.features as Record<string, string>;
    // 8993 sets form=infinitive; 9004 sets tense=past, voice=active, mood=declarative, form=finite.
    expect(features.form).toBe("finite");
    expect(features.tense).toBe("past");
    expect(features.voice).toBe("active");
    expect(features.mood).toBe("declarative");
  });

  test("sub-sequence match without indicators: input [100,200,300] matches dict [100,200]", () => {
    const ctx = buildProcessorContext(["100", "200", "300"]);
    const match = ctx.subSequenceMatches.find(
      (m) => m.startIndex === 0 && m.endIndex === 2 && m.matchedSymbolId === "9000"
    );
    expect(match).toBeDefined();
    expect(match?.matchedGloss).toBe("alpha-beta-compound");
  });

  test("sub-sequence match strips input indicators: [100, IND, 200] matches dict [100,200]", () => {
    const ctx = buildProcessorContext(["100", "8993", "200"]);
    const matchedIds = ctx.subSequenceMatches
      .filter((m) => m.startIndex === 0 && m.endIndex === 3)
      .map((m) => m.matchedSymbolId)
      .sort();
    // Both 9000 (composition [100,/,200]) and 9001 (composition [100,;,8993,/,200])
    // canonicalize to [100,200] and match the indicator-stripped slice.
    expect(matchedIds).toEqual(["9000", "9001"]);
  });

  test("sub-sequence does not consider single-element slices", () => {
    const ctx = buildProcessorContext(["100"]);
    expect(ctx.subSequenceMatches).toEqual([]);
  });

  test("annotation includes indicator entry when ID is in INDICATOR_SEMANTICS", () => {
    const ctx = buildProcessorContext(["8993"]);
    expect(ctx.annotations[0].indicator).toBeDefined();
    expect((ctx.annotations[0].indicator as Record<string, unknown>).POS).toBe("verb");
  });
});

describe("buildSystemPrompt", () => {
  test("default English target", () => {
    const prompt = buildSystemPrompt("en");
    expect(prompt).toContain("Translate the final interpretation into: English.");
  });

  test("Swedish target", () => {
    const prompt = buildSystemPrompt("sv");
    expect(prompt).toContain("Translate the final interpretation into: Swedish.");
  });

  test("unknown language falls back to passing the code as label", () => {
    const prompt = buildSystemPrompt("xx");
    expect(prompt).toContain("Translate the final interpretation into: xx.");
  });
});

describe("buildUserPrompt", () => {
  test("output is valid JSON for the context plus a trailing instruction", () => {
    const ctx = buildProcessorContext(["100", "200"]);
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain("Return JSON array of candidate interpretations.");
    const jsonPart = prompt.split("\n\nReturn")[0];
    expect(() => JSON.parse(jsonPart)).not.toThrow();
    const parsed = JSON.parse(jsonPart);
    expect(parsed.inputIds).toEqual(["100", "200"]);
  });
});

describe("interpretBlissWord", () => {
  test("empty input returns [] without calling queryChat", async () => {
    const result = await interpretBlissWord([]);
    expect(result).toEqual([]);
    expect(mockedQueryChat).not.toHaveBeenCalled();
  });

  test("valid JSON array response is parsed and truncated to candidateCount", async () => {
    mockedQueryChat.mockResolvedValue({
      message: { content: "[\"first\", \"second\", \"third\", \"fourth\"]" }
    });
    const result = await interpretBlissWord(["100", "200"], { candidateCount: 2 });
    expect(result).toEqual(["first", "second"]);
  });

  test("malformed JSON containing an array substring is recovered", async () => {
    mockedQueryChat.mockResolvedValue({
      message: { content: "Here you go: [\"alpha\", \"beta\"] hope this helps" }
    });
    const result = await interpretBlissWord(["100"]);
    expect(result).toEqual(["alpha", "beta"]);
  });

  test("newline-separated text falls back to split parsing", async () => {
    mockedQueryChat.mockResolvedValue({
      message: { content: "one\n  two  \n\nthree" }
    });
    const result = await interpretBlissWord(["100"]);
    expect(result).toEqual(["one", "two", "three"]);
  });

  test("queryChat rejection is propagated", async () => {
    mockedQueryChat.mockRejectedValue(new Error("network down"));
    await expect(interpretBlissWord(["100"])).rejects.toThrow("network down");
  });

  test("throws when no model is available", async () => {
    adaptivePaletteGlobals.LLMs = [];
    await expect(interpretBlissWord(["100"])).rejects.toThrow("No LLM model available");
    expect(mockedQueryChat).not.toHaveBeenCalled();
  });

  test("uses explicit modelName option over LLMs[0]", async () => {
    adaptivePaletteGlobals.LLMs = ["default-model"];
    mockedQueryChat.mockResolvedValue({ message: { content: "[\"x\"]" } });
    await interpretBlissWord(["100"], { modelName: "explicit-model" });
    const callArgs = mockedQueryChat.mock.calls[0];
    expect(callArgs[1]).toBe("explicit-model");
  });

  test("passes a system prompt and a user prompt to queryChat", async () => {
    mockedQueryChat.mockResolvedValue({ message: { content: "[\"x\"]" } });
    await interpretBlissWord(["100"], { targetLanguage: "en" });
    const [userPrompt, , streamFlag, systemPrompt] = mockedQueryChat.mock.calls[0];
    expect(streamFlag).toBe(false);
    expect(systemPrompt).toContain("English");
    expect(userPrompt).toContain("\"inputIds\"");
  });
});
