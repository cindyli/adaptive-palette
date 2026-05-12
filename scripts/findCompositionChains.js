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

/**
 * This script loops through all entries in
 * `./public/data/bliss_symbol_explanations.json` and finds entries whose last
 * numeric ID in the `composition` array equals the first numeric ID in the
 * `composition` array of one or more other entries. Such chains hint at
 * sequential composition patterns where one Bliss-word ends with the same
 * primitive that another begins with.
 *
 * Non-numeric tokens in `composition` (e.g. "/", ";", "Xa", "RK:-2") are
 * separators or modifiers and are ignored when picking first/last IDs.
 *
 * Output:
 *   - A JSON report written to `./scripts/compositionChains.json` listing each
 *     source entry and its matching target entries.
 *   - Summary counts printed to stdout.
 *
 * Usage:
 *   node scripts/findCompositionChains.js
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_PATH = resolve(
  process.cwd(),
  "public/data/bliss_symbol_explanations.json"
);
const OUT_PATH = resolve(__dirname, "compositionChains.json");

const entries = JSON.parse(readFileSync(DATA_PATH, "utf8"));

const firstId = (c) => c.find((x) => typeof x === "number");

const lastId = (c) => {
  for (let i = c.length - 1; i >= 0; i--) {
    if (typeof c[i] === "number") return c[i];
  }
  return undefined;
};

// Index entries by the first numeric ID of their composition.
const byFirstId = new Map();
for (const e of entries) {
  if (!e.composition) continue;
  const f = firstId(e.composition);
  if (f === undefined) continue;
  if (!byFirstId.has(f)) byFirstId.set(f, []);
  byFirstId.get(f).push(e);
}

const report = [];

for (const e of entries) {
  if (!e.composition) continue;
  const l = lastId(e.composition);
  if (l === undefined) continue;
  const candidates = byFirstId.get(l);
  if (!candidates) continue;
  const matches = candidates.filter((c) => c.id !== e.id);
  if (matches.length === 0) continue;
  report.push({
    source: {
      id: e.id,
      description: e.description,
      composition: e.composition,
    },
    joinId: l,
    matches: matches.map((m) => ({
      id: m.id,
      description: m.description,
      composition: m.composition,
    })),
  });
}

writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

const totalPairs = report.reduce((n, r) => n + r.matches.length, 0);
console.log(`Entries scanned: ${entries.length}`);
console.log(`Entries with composition: ${entries.filter((e) => e.composition).length}`);
console.log(`Source entries with at least one chain match: ${report.length}`);
console.log(`Total source→target pairs: ${totalPairs}`);
console.log(`Report written to: ${OUT_PATH}`);
