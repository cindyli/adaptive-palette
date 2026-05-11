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
import { decomposeBciAvId } from "./SvgUtils";
import { queryChat } from "./ollamaApi";
import {
  INDICATOR_SEMANTICS,
  MODIFIER_SEMANTICS,
  IndicatorSemantics,
  ModifierSemantics
} from "./blissSemantics";
import { BciAvIdType } from "./index.d";

export type ProcessOptions = {
  targetLanguage?: string;
  modelName?: string;
  candidateCount?: number;
};

export type SymbolPosition = "only" | "first" | "last" | "middle";

export type SymbolAnnotation = {
  id: string;
  position: SymbolPosition;
  gloss?: string;
  explanation?: string;
  isCharacter?: boolean;
  indicator?: IndicatorSemantics;
  modifier?: {
    semantics: ModifierSemantics;
    roleAmbiguous: boolean;
  };
};

export type SubSequenceMatch = {
  startIndex: number;
  endIndex: number;
  matchedSymbolId: string;
  matchedGloss: string;
};

export type IndicatorEffectsMerged = Record<string, unknown>;

export type ProcessorContext = {
  inputIds: string[];
  annotations: SymbolAnnotation[];
  indicatorEffects: IndicatorEffectsMerged;
  subSequenceMatches: SubSequenceMatch[];
};

const DEFAULT_TARGET_LANGUAGE = "en";
const DEFAULT_CANDIDATE_COUNT = 5;
const NO_MODEL_ERROR = "No LLM model available";

const TARGET_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  sv: "Swedish"
};

type BciAvSymbolEntry = {
  id: string;
  description?: string;
  explanation?: string;
  isCharacter?: boolean;
  composition?: (string | number)[];
};

function getBciAvSymbols(): BciAvSymbolEntry[] {
  return adaptivePaletteGlobals.bciAvSymbols as unknown as BciAvSymbolEntry[];
}

function lookupSymbol(id: string): BciAvSymbolEntry | undefined {
  return getBciAvSymbols().find((entry) => entry.id === id);
}

function positionOf(index: number, total: number): SymbolPosition {
  if (total === 1) return "only";
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Walk a modifier entry and collect every "position" value found anywhere in
// its `features` (including under `or` / `and` branches). Used to decide
// whether a symbol is prefix-capable, suffix-capable, or both.
function collectPositions(entry: unknown, acc: Set<string>): void {
  if (!isPlainObject(entry)) return;
  const orBranches = entry.or;
  if (Array.isArray(orBranches)) {
    orBranches.forEach((branch) => collectPositions(branch, acc));
  }
  const andBranches = entry.and;
  if (Array.isArray(andBranches)) {
    andBranches.forEach((branch) => collectPositions(branch, acc));
  }
  const features = entry.features;
  if (isPlainObject(features)) {
    const pos = features.position;
    if (typeof pos === "string") {
      acc.add(pos);
    } else if (Array.isArray(pos)) {
      pos.forEach((p) => {
        if (typeof p === "string") acc.add(p);
      });
    }
  }
}

function annotateModifier(
  id: string,
  position: SymbolPosition
): SymbolAnnotation["modifier"] | undefined {
  const entry = MODIFIER_SEMANTICS[id];
  if (!entry) return undefined;
  const positions = new Set<string>();
  collectPositions(entry, positions);
  const prefixCapable = positions.has("prefix") || positions.has("pre");
  const suffixCapable = positions.has("suffix") || positions.has("post");
  switch (position) {
  case "first":
  case "only":
    if (!prefixCapable) return undefined;
    return { semantics: entry, roleAmbiguous: false };
  case "last":
    if (!suffixCapable) return undefined;
    return { semantics: entry, roleAmbiguous: false };
  case "middle":
    if (!prefixCapable && !suffixCapable) return undefined;
    return { semantics: entry, roleAmbiguous: prefixCapable && suffixCapable };
  }
}

function mergeIndicatorEffects(annotations: SymbolAnnotation[]): IndicatorEffectsMerged {
  const merged: Record<string, unknown> = {};
  for (const annotation of annotations) {
    const indicator = annotation.indicator;
    if (!indicator) continue;
    for (const [key, value] of Object.entries(indicator)) {
      if (key === "features" && isPlainObject(value)) {
        const existing = isPlainObject(merged.features) ? merged.features : {};
        merged.features = { ...existing, ...value };
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function stripInputIndicators(ids: string[]): string[] {
  return ids.filter((id) => !(id in INDICATOR_SEMANTICS));
}

function buildCanonicalFromComposition(composition: BciAvIdType): string[] {
  const decomposed = decomposeBciAvId(composition);
  if (!Array.isArray(decomposed)) return [];
  const out: string[] = [];
  for (let i = 0; i < decomposed.length; i++) {
    const elem = decomposed[i];
    // Indicators are marked by ";" immediately followed by the indicator ID.
    // Skip both the ";" and the next element.
    if (elem === ";") {
      i++;
      continue;
    }
    if (elem === "/") continue;
    if (typeof elem === "string" && elem.startsWith("RK:")) continue;
    if (typeof elem === "number") {
      out.push(String(elem));
    }
    // Other unrecognized string markers are dropped.
  }
  return out;
}

type CanonicalCache = {
  source: BciAvSymbolEntry[];
  byLength: Map<number, Array<{ id: string; canon: string[]; gloss: string }>>;
};

let canonicalCache: CanonicalCache | null = null;

function getCanonicalDictionary(): CanonicalCache["byLength"] {
  const source = getBciAvSymbols();
  if (canonicalCache && canonicalCache.source === source) {
    return canonicalCache.byLength;
  }
  const byLength = new Map<number, Array<{ id: string; canon: string[]; gloss: string }>>();
  for (const entry of source) {
    if (!entry.composition || !Array.isArray(entry.composition)) continue;
    const canon = buildCanonicalFromComposition(entry.composition);
    if (canon.length < 2) continue;
    const bucket = byLength.get(canon.length) ?? [];
    bucket.push({ id: entry.id, canon, gloss: entry.description ?? "" });
    byLength.set(canon.length, bucket);
  }
  canonicalCache = { source, byLength };
  return byLength;
}

// Test-only hook to invalidate the canonical cache when the test mutates
// `adaptivePaletteGlobals.bciAvSymbols` in place rather than swapping the
// reference.
export function __resetCanonicalCache(): void {
  canonicalCache = null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function findSubSequenceMatches(inputIds: string[]): SubSequenceMatch[] {
  if (inputIds.length < 2) return [];
  const dictionary = getCanonicalDictionary();
  const matches: SubSequenceMatch[] = [];
  for (let start = 0; start < inputIds.length; start++) {
    for (let end = start + 2; end <= inputIds.length; end++) {
      const slice = inputIds.slice(start, end);
      const canon = stripInputIndicators(slice);
      if (canon.length < 2) continue;
      const bucket = dictionary.get(canon.length);
      if (!bucket) continue;
      for (const candidate of bucket) {
        if (arraysEqual(canon, candidate.canon)) {
          matches.push({
            startIndex: start,
            endIndex: end,
            matchedSymbolId: candidate.id,
            matchedGloss: candidate.gloss
          });
        }
      }
    }
  }
  return matches;
}

export function buildProcessorContext(inputIds: string[]): ProcessorContext {
  const total = inputIds.length;
  const annotations: SymbolAnnotation[] = inputIds.map((id, index) => {
    const position = positionOf(index, total);
    const annotation: SymbolAnnotation = { id, position };
    const symbol = lookupSymbol(id);
    if (symbol) {
      if (symbol.description !== undefined) annotation.gloss = symbol.description;
      if (symbol.explanation !== undefined) annotation.explanation = symbol.explanation;
      if (symbol.isCharacter !== undefined) annotation.isCharacter = symbol.isCharacter;
    }
    if (Object.prototype.hasOwnProperty.call(INDICATOR_SEMANTICS, id)) {
      annotation.indicator = INDICATOR_SEMANTICS[id];
    }
    if (Object.prototype.hasOwnProperty.call(MODIFIER_SEMANTICS, id)) {
      const modifier = annotateModifier(id, position);
      if (modifier) annotation.modifier = modifier;
    }
    return annotation;
  });
  const indicatorEffects = mergeIndicatorEffects(annotations);
  const subSequenceMatches = findSubSequenceMatches(inputIds);
  return { inputIds, annotations, indicatorEffects, subSequenceMatches };
}

export function buildSystemPrompt(targetLanguage: string): string {
  const langLabel = TARGET_LANGUAGE_LABELS[targetLanguage] ?? targetLanguage;
  return `You interpret one Blissymbolics word into ranked natural-language candidates.

Input is a single Bliss word as a flat array of BCI-AV symbol IDs. The word may flatten multiple sub-words; you must decide sub-word boundaries using the structured hints provided.

Bliss structural rule for a (sub-)word:
  (0+ modifiers) + (1 classifier) + (0 or 1 indicator) + (0+ specifiers / modifiers)

Composition patterns:
- Classifier + specifier produces a hyponym of the classifier. Example: citrus_fruit/small -> clementine.
- A modifier prefix transforms the classifier. Example: opposite_of/hot -> cold.

Role rules by position:
- A symbol that can act as either modifier (prefix) or specifier (suffix) is locked by position: prefix-only at the absolute first position, suffix-only at the absolute last position, and either role at middle positions.

Use the provided context fields:
- "annotations" gives gloss, explanation, position, and role semantics per ID. "modifier.roleAmbiguous=true" means you must pick the role from context.
- "indicatorEffects" is the merged grammatical effect (POS, tense, etc.) that applies at the WHOLE-WORD level.
- "subSequenceMatches" lists contiguous ID slices that match a known dictionary symbol (indicators already stripped). Use as hints for sub-word boundaries; multiple overlapping matches may appear - pick the most plausible decomposition.

Translate the final interpretation into: ${langLabel}.

Return ONLY a JSON array of candidate words or phrases, best-first. No prose, no commentary.`;
}

export function buildUserPrompt(ctx: ProcessorContext): string {
  return `${JSON.stringify(ctx, null, 2)}\n\nReturn JSON array of candidate interpretations.`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parseResponse(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    if (isStringArray(parsed)) return parsed;
  } catch {
    // fallthrough
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (isStringArray(parsed)) return parsed;
    } catch {
      // fallthrough
    }
  }
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

export async function interpretBlissWord(
  inputIds: string[],
  options: ProcessOptions = {}
): Promise<string[]> {
  if (inputIds.length === 0) return [];

  const targetLanguage = options.targetLanguage ?? DEFAULT_TARGET_LANGUAGE;
  const candidateCount = options.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  const modelName = options.modelName ?? adaptivePaletteGlobals.LLMs[0];
  if (!modelName) throw new Error(NO_MODEL_ERROR);

  const ctx = buildProcessorContext(inputIds);
  const systemPrompt = buildSystemPrompt(targetLanguage);
  const userPrompt = buildUserPrompt(ctx);

  const response = await queryChat(userPrompt, modelName, false, systemPrompt);
  const text: string = response?.message?.content ?? "";
  const candidates = parseResponse(text);
  return candidates.slice(0, candidateCount);
}
