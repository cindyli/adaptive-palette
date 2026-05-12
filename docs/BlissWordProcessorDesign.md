# Bliss Word Processor — Design

## Context

The Bliss Word Processor interprets a user-composed Bliss word — a flat array of Bliss symbol IDs that may
flatten multiple sub-words — into a ranked list of natural-language word/phrase candidates in a target language.

v1 is the **processor module only**. No UI integration. Input is the flat ID array of one composed word
(drawn from `changeEncodingContents.payloads` at call sites later, but the v1 module is decoupled from UI).

The processor has two stages: a deterministic rule-based engine that annotates the input with structural and
semantic information, and an LLM round-trip (Ollama, via existing infrastructure) that resolves sub-word
boundaries and produces ranked candidate interpretations.

## High-level overview

The processor is a two-stage pipeline behind a single async function. Stage one is the **rule-based engine** —
fully deterministic, no I/O beyond reading already-loaded globals. Stage two is the **LLM layer** — a single
round-trip to Ollama for context-dependent reasoning.

### Engine responsibility (deterministic)

What the engine **owns** (mechanical, observable, position-locked):

- Per-symbol gloss/explanation lookup from the BCI-AV dictionary.
- Sub-sequence dictionary matching: every contiguous slice of length ≥ 2 is checked (with indicators stripped on
  both sides) against the dictionary's canonical compositions, surfacing all matches as hints.
- Indicator detection and merging from `INDICATOR_SEMANTICS` (extracts word-level POS, tense, etc.).
- Modifier role resolution from `MODIFIER_SEMANTICS` using each modifier's index in `inputIds`. Locked-role
  modifiers emit role-filtered semantics; structurally ambiguous modifiers carry `roleAmbiguous: true`.

What the engine **does NOT do**: choose between roles at ambiguous positions, decide sub-word boundaries when
multiple overlapping matches exist, or invent meaning. Those are interpretive and belong to the LLM.

### LLM layer responsibility (interpretive)

The LLM receives the engine's structured `ProcessorContext` plus a system prompt that teaches it the descriptive
Bliss rules. It must:

- Decide sub-word nesting from the flat ID array, using `subSequenceMatches` as hints.
- Resolve modifier-vs-specifier ambiguity at middle positions.
- Compose sub-word meanings into the whole-word meaning, applying word-level indicator effects (POS, tense, etc.).
- Translate the result into the requested target language.
- Return a ranked JSON array of candidate interpretations, best-first.

The LLM does not see raw Bliss IDs as opaque tokens — it sees the engine's annotated context, so its task is
bounded reasoning rather than open lookup.

## Scope

- Build processor module + semantics data + tests.
- No UI wiring, no server endpoint, no sentence-level (multi-word) flow.
- Configurable target language (default `'en'`); dictionary remains English-only — LLM translates when targeting
  other languages.
- Full LLM round-trip inside the module; caller passes IDs and gets candidate strings.

## Files

**New:**

- `src/client/blissSemantics.ts` — typed TS port of `INDICATOR_SEMANTICS` + `MODIFIER_SEMANTICS`.
- `src/client/blissWordProcessor.ts` — engine + LLM layer (the API below).
- `src/client/blissWordProcessor.test.ts` — unit tests (mocked `queryChat`, stubbed globals).

**Reused (no edits):**

- `src/client/ollamaApi.ts` — `queryChat`.
- `src/client/SvgUtils.ts` — `decomposeBciAvId`.
- `adaptivePaletteGlobals.bciAvSymbols`, `adaptivePaletteGlobals.LLMs` from `src/client/GlobalData.ts`.
- `public/data/bliss_symbol_explanations.json`.

## Public API

```ts
export type ProcessOptions = {
  targetLanguage?: string;   // default 'en'
  modelName?: string;        // default first from adaptivePaletteGlobals.LLMs
  candidateCount?: number;   // default 5
};

export type SymbolAnnotation = {
  id: string;
  gloss?: string;
  explanation?: string;
  isCharacter?: boolean;
  indicator?: IndicatorSemantics;       // present if id is an indicator
  modifier?: {
    semantics: ModifierSemantics;
    roleAmbiguous?: true;               // present only when ambiguous; omitted when role is locked
  };
};

export type SubSequenceMatch = {
  startIndex: number;                   // inclusive index into inputIds
  endIndex: number;                     // exclusive
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

// Main entry — full round-trip.
export async function interpretBlissWord(
  inputIds: string[],
  options?: ProcessOptions
): Promise<string[]>;

// Exposed for testing and finer-grained callers.
export function buildProcessorContext(inputIds: string[]): ProcessorContext;
export function buildSystemPrompt(targetLanguage: string): string;
export function buildUserPrompt(ctx: ProcessorContext): string;
```

## Engine logic (rule-based)

### Per-symbol annotation

Iterate `inputIds`. For each ID at index `i` (length `N`):

- Lookup gloss/explanation/isCharacter from `adaptivePaletteGlobals.bciAvSymbols`.
- Indicator: if id is a key in `INDICATOR_SEMANTICS`, attach the entry to `annotation.indicator`.
- Modifier: if id is a key in `MODIFIER_SEMANTICS`, inspect the entry's declared positions
  (walking `or` and `and` branches) to determine prefix-capable / suffix-capable, then apply by index:
  - `i === 0` (first / only):
    - prefix-capable → emit prefix-role semantics. Omit `roleAmbiguous`.
    - else (suffix-only) → emit suffix-role semantics + `roleAmbiguous: true`.
  - `i === N - 1` (last):
    - suffix-capable → emit suffix-role semantics. Omit `roleAmbiguous`.
    - else (prefix-only) → emit prefix-role semantics + `roleAmbiguous: true`.
  - middle (`0 < i < N - 1`):
    - emit all role semantics + `roleAmbiguous: true`.

Non-modifier IDs do not need position information — `inputIds` ordering is the only signal the LLM
requires for them.

### Indicator merge

Collect all annotations with `indicator` set. Merge into a single `IndicatorEffectsMerged`:

- Scalar fields (`POS`, `tense`, `mood`, `voice`, `form`, `category`, etc.): last-wins on conflict.
- `features`: shallow object merge, last-wins per key.

### Sub-sequence dictionary match

Indicators apply at the word level, not the sub-word level — strip them on **both** sides before comparing.
One canonical equality check per sub-range.

Indicator detection differs by side:

- **Dictionary side**: the canonical Bliss-composition format places `";"` immediately before each indicator ID.
  Strip every `";"` plus the ID that follows it. Do NOT use `INDICATOR_SEMANTICS` membership here — the
  structural marker is `;`, and a symbol may appear in a composition in a non-indicator role.
- **Input side**: the user's input is a flat ID array with no separators. Identify indicators via membership in
  `INDICATOR_SEMANTICS` (the fixed indicator-symbol set).

Algorithm:

1. Build canonical dictionary form (memoized per session): for each `bciAvSymbols` entry with non-empty
   `composition`, run `decomposeBciAvId`, then walk the resulting array linearly:
   - On `";"`: skip the `;` and the next element.
   - On `"/"`: skip.
   - On a string starting with `"RK:"`: skip.
   - Otherwise: keep, cast to string.

   Result: `Map<symbolId, string[]>` of canonical ID sequences (no indicators, no layout markers), bucketed
   by length for fast lookup.
2. For each contiguous sub-range `[start, end)` of `inputIds` with length ≥ 2, build the slice's canonical
   form by removing IDs whose value is a key in `INDICATOR_SEMANTICS`.
3. Single equality check against the canonical map values (length-bucketed).
4. Record matches. Multiple overlapping matches allowed; LLM disambiguates.

### Assemble `ProcessorContext`

Plain object with `inputIds`, `annotations`, `indicatorEffects`, `subSequenceMatches`. No further reasoning
in the engine.

## LLM layer

### `buildSystemPrompt(targetLanguage)`

Static template describing:

- Input represents one Bliss word that may flatten multiple sub-words.
- Structural rule: `(0+ modifiers) + (1 classifier) + (0 or 1 indicator) + (0+ specifiers / modifiers)`.
- Classifier/specifier hyponym pattern (`citrus_fruit/small -> clementine`).
- Modifier alternative pattern (`opposite_of/hot -> cold`).
- Position-locked role rules: prefix-only modifier at first, suffix-only at last, ambiguous at middle.
- Sub-words must be inferred using `subSequenceMatches` hints plus glosses.
- Indicators apply at the word level (POS, tense, etc.) per `indicatorEffects`.
- Output instruction: return a JSON array of ranked candidate words/phrases in `targetLanguage`, best-first.
  No prose, no explanation.

### `buildUserPrompt(ctx)`

`JSON.stringify(ctx)` (pretty-printed) plus a trailing instruction line:
`Return JSON array of candidate interpretations.`

### Call

```ts
const modelName = options.modelName ?? adaptivePaletteGlobals.LLMs[0];
const resp = await queryChat(userPrompt, modelName, false, systemPrompt);
const text = resp.message.content;
```

Non-streaming. Single response.

### Parse

1. `JSON.parse(text)` → expect `string[]`; validate.
2. On failure: regex-extract first `[...]` substring, `JSON.parse`.
3. On still-failure: split by `\n`, trim, drop empties — return as fallback array.
4. Truncate to `candidateCount`.

### Errors

- Empty `inputIds` → return `[]` without an LLM call.
- `LLMs` empty AND no `options.modelName` → throw `Error("No LLM model available")`.
- `queryChat` rejects → propagate; caller handles UI.

### Example prompt

Illustrative example using a `222/333/444;555` shape (IDs are placeholders; `555` is an indicator).
Caller invokes `interpretBlissWord(["222","333","444","555"], { targetLanguage: "en", candidateCount: 5 })`.

**System prompt (sent verbatim each call, language-templated):**

```text
You interpret one Blissymbolics word into ranked natural-language candidates.

Input is a single Bliss word as a flat array of BCI-AV symbol IDs. The word may flatten multiple sub-words;
you must decide sub-word boundaries using the structured hints provided.

Bliss structural rule for a word including sub-words and the word at the top level:
  (0+ modifiers) + (1 classifier) + (0 or 1 indicator) + (0+ specifiers / modifiers)

Composition patterns:
- Classifier + specifier produces a hyponym of the classifier. Example: citrus_fruit/small -> clementine.
- A modifier transforms the classifier. Example: opposite_of/hot -> cold.

Role rules by position:
- Some symbols can act as either a modifier or a specifier. Example:
meat/part -> diced meat; part/year -> season

Use the provided context fields:
- "annotations" gives gloss, explanation, and (when relevant) role semantics per ID, in the same order
  as "inputIds". Derive first / last position from the array index when needed. "modifier.roleAmbiguous=true"
  means you must pick the role from context.
- "indicatorEffects" is the merged grammatical effect (POS, tense, etc.) that applies at the WHOLE-WORD
  level.
- "subSequenceMatches" lists contiguous ID slices that match a known dictionary symbol (indicators already
  stripped). Use as hints for sub-word boundaries; multiple overlapping matches may appear - pick the most
  plausible decomposition.

Translate the final interpretation into: English.

Return ONLY a JSON array of candidate words or phrases, best-first. No prose, no commentary.
```

**User prompt (engine-generated `ProcessorContext` plus trailing instruction):**

```text
{
  "inputIds": ["222", "333", "444", "555"],
  "indicatorEffects": {
    "POS": "verb",
    "features": { "form": "infinitive" }
  },
  "annotations": [
    { "id": "222", "gloss": "word_for_222", "explanation": "..." },
    { "id": "333", "gloss": "word_for_333", "explanation": "...",
      "modifier": {
        "semantics": { "features": { "position": "suffix", "middle-position": "suffix-first-part" } },
        "roleAmbiguous": true
      }
    },
    { "id": "444", "gloss": "word_for_444", "explanation": "..." },
    { "id": "555", "gloss": "verb_indicator_infinitive",
      "indicator": { "POS": "verb", "category": "grammatical", "features": { "form": "infinitive" } }
    }
  ],
  "subSequenceMatches": [
    { "startIndex": 0, "endIndex": 2, "matchedSymbolId": "9001", "matchedGloss": "compound_222_333" },
    { "startIndex": 1, "endIndex": 3, "matchedSymbolId": "9002", "matchedGloss": "compound_333_444" }
  ]
}

Return JSON array of candidate interpretations.
```

**Expected response shape:**

```json
["to candidate-one", "to candidate-two", "to candidate-three", "to candidate-four", "to candidate-five"]
```

The `"to "` prefixes reflect the verb-infinitive `indicatorEffects` applied at the word level.

### Walkthrough — resolving middle-modifier ambiguity

The engine flagged `333` with `modifier.roleAmbiguous: true`. The engine could not decide whether `333` acts
as a modifier (prefix that transforms what follows) or a specifier (suffix that narrows what precedes). The
LLM must pick one using the structural hints.

Two overlapping `subSequenceMatches` are provided:

- `[0, 2)` → `compound_222_333`. Implies sub-word `222 + 333` with `333` acting as specifier of `222`,
  leaving `444` as a separate sub-word.
- `[1, 3)` → `compound_333_444`. Implies sub-word `333 + 444` with `333` acting as modifier of `444`,
  leaving `222` as a separate (preceding) sub-word.

Reasoning trace expected from the LLM:

1. Read each candidate's matched gloss and compare it to the per-ID glosses and explanations in
   `annotations`. Pick the decomposition whose meaning coheres best in the target language.
2. Cross-check the unchosen ID(s) as a separate sub-word: does the classifier / specifier / modifier
   structure of the remainder make sense?
3. Apply `indicatorEffects` (here: POS=verb, form=infinitive) at the WHOLE-WORD level after sub-word
   composition. The infinitive marker propagates to the top-level rendering (e.g. `"to ..."` in English).
4. Rank candidates by overall semantic coherence — best first. If both decompositions are plausible,
   surface both in the output list.

Key takeaway: `roleAmbiguous: true` is not a defect signal — it is an explicit request to use
`subSequenceMatches` + glosses to commit to a role, then justify it through the resulting
interpretation's plausibility.

This walkthrough is developer-facing documentation. It is **not** sent to the LLM verbatim. The condensed
structural-rule text already in the system prompt is what the LLM sees per call. If runtime testing shows
the LLM struggles with middle-modifier ambiguity, distill key lines from this walkthrough into the system
prompt itself — but defer until evidence warrants the prompt-size cost.

## Testing

`src/client/blissWordProcessor.test.ts`:

- `buildProcessorContext`:
  - Empty input → empty arrays + empty effects.
  - Single ID (non-modifier) → annotation present with gloss; no `modifier` block; no `position` field.
  - Modifier-capable symbol at first / last / middle → role-filtered `modifier.semantics`; `roleAmbiguous`
    present only when ambiguous, omitted when role is locked.
  - Modifier at first but only suffix-capable → emits suffix semantics + `roleAmbiguous: true`.
  - Modifier at last but only prefix-capable → emits prefix semantics + `roleAmbiguous: true`.
  - Multiple indicators → merged `indicatorEffects`, last-wins on conflict.
  - Sub-sequence match: input `[A, B, C]`, dict entry canonicalizing to `[A, B]` → one match at `[0, 2)`.
  - Indicator stripping: input `[A, IND, B]` matches dict entries canonicalizing to `[A, B]`.
  - No false-positive on length-1 sub-ranges.
- `buildSystemPrompt`: `'en'` and `'sv'` produce target-language instructions; unknown code passes through.
- `buildUserPrompt`: output is valid JSON; round-trips `ProcessorContext`.
- `interpretBlissWord` (mocked `queryChat`):
  - Empty input → `[]`, `queryChat` not called.
  - Valid JSON array response → returned, truncated to `candidateCount`.
  - Malformed JSON with embedded array → regex fallback recovers.
  - Newline-separated plain text → split fallback recovers.
  - `queryChat` rejects → promise rejects with same error.
  - No model available → throws `"No LLM model available"`.
  - Explicit `modelName` overrides `LLMs[0]`.
  - `queryChat` receives system + user prompts and `stream=false`.

## Verification

```bash
npm run lint
npm run test:client -- src/client/blissWordProcessor.test.ts
```

Manual smoke test (Ollama running locally with a configured model): from a small REPL/script, call
`interpretBlissWord(['<citrus_fruit_id>', '<small_id>'])` and confirm a ranked array including a
clementine-like candidate.

## Continuing work next time

### Current status (end of this session)

- v1 module shipped on branch `feat/bliss-word-processor`:
  - `src/client/blissSemantics.ts` — TS port of `INDICATOR_SEMANTICS` + `MODIFIER_SEMANTICS`.
  - `src/client/blissWordProcessor.ts` — engine + LLM round-trip with the API documented above.
  - `src/client/blissWordProcessor.test.ts` — 25 passing unit tests covering every code path
    (annotation, indicator merge, dictionary canonicalization with `;` indicator stripping, all parse-fallback
    branches in `interpretBlissWord`, error paths, model-selection precedence).
- `npm run lint` clean. `npm run test:client` 31/31 suites, 129/129 tests pass.
- `docs/bliss_semantics.py` left in place (pending manual deletion by Cindy).

### Pick up here

1. **Manual smoke test.** Run Ollama locally with a chat model installed, then exercise the module from a
   small script or the dev server console. Confirm the LLM honors the JSON-only output instruction across
   models. If it doesn't, tighten the system prompt (e.g. add explicit "no markdown fences" wording) rather
   than expanding the regex fallback.
2. **Delete `docs/bliss_semantics.py`** once the TS port is confirmed equivalent. The TS file is now the
   source of truth.
3. **Wire into UI (deferred from v1).** Likely shape:
   - A new Command cell (mirror `CommandTelegraphicCompletions`) that pulls IDs from
     `changeEncodingContents.payloads`, calls `interpretBlissWord`, and writes results to a new signal.
   - A new Content cell to render the ranked candidates, OR reuse `sentenceCompletionsSignal` +
     `SentenceCompletionsPalette` for minimal new UI.
   - Decide which is right when revisiting.
4. **Sentence-level flow (deferred from v1).** Original design doc described a sentence-array input mixing
   strings and arrays of IDs. v1 collapsed to a single composed word. Reintroduce the sentence wrapper when
   the multi-word context becomes useful — likely as a thin layer that calls `interpretBlissWord` per
   composed sub-array and threads the surrounding sentence in as additional system-prompt context.
5. **Combine-marker symbol (id 13382).** Explicitly out of scope for v1. When that conversation begins,
   extend `buildProcessorContext` to recognize 13382 brackets and emit a distinct sub-word grouping in the
   `ProcessorContext`. The current sub-sequence matcher already ignores it as an unrecognized marker.
6. **Performance.** Canonical dictionary is memoized identity-keyed on `adaptivePaletteGlobals.bciAvSymbols`.
   First call after globals load builds it once. If we ever swap symbols at runtime, callers can invoke
   `__resetCanonicalCache()` (currently exported for tests; promote to public if real callers need it).

### Known open questions

- Modifier role-capable detection currently inspects every `or` / `and` branch and unions all `position`
  values. Symbols whose position varies by context (e.g. several entries with `notes: "position is prefix
  when ..., suffix when ..."` but only one declared `position`) are emitted as single-role only. If this
  proves too restrictive, expand `collectPositions` to honor the notes — but only with a real test case.
- Indicator merge uses last-wins on conflict. The Python source has `priority` arrays declaring intended
  precedence between equivalent indicators/modifiers. v1 ignores `priority` for merging. Revisit if conflict
  cases surface that `priority` would resolve correctly.
- Target-language label table currently covers only `en` / `sv`. Add more entries to `TARGET_LANGUAGE_LABELS`
  in `blissWordProcessor.ts` as new languages come online.
