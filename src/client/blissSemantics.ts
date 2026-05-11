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
 * Blissymbolics Linguistic Annotation Schema
 *
 * Metadata and semantics for Blissymbolics indicators and modifiers. Each
 * entry may carry: `POS`, `category`, `features`, `priority`, `position`,
 * `middle-position`, `equivalent_indicator` / `equivalent_modifier`,
 * `notes`, plus disjunctions (`or`) and conjunctions (`and`) of sub-entries.
 *
 * See docs/BlissWordProcessorDesign.md for how the engine consumes these.
 */

// Permissive shape — entries are heterogeneous (some use `or` / `and` for
// alternative meanings). The processor walks them dynamically.
export type IndicatorSemantics = Record<string, unknown>;
export type ModifierSemantics = Record<string, unknown>;

export const INDICATOR_SEMANTICS: Record<string, IndicatorSemantics> = {
  // action indicators
  // infinitive verb or present tense verb; similar to ID 24807 (which adds
  // tense=present); 8993 omits tense.
  "8993": {
    POS: "verb",
    category: "grammatical",
    features: { form: "infinitive" },
    priority: ["8993", "24807"]
  },
  // active verb
  "8994": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "present", voice: "active", mood: "declarative", form: "finite" }
  },
  // present conditional
  "8995": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "present", voice: "active", mood: "conditional", form: "finite" }
  },
  // description indicators
  // English -ed / -en
  "8996": {
    POS: ["adjective", "adverb"],
    category: "semantic",
    features: { modality: "completed" }
  },
  // English -able
  "8997": {
    POS: ["adjective", "adverb"],
    category: "semantic",
    features: { modality: "potential" }
  },
  // English adjectives / adverbs
  "8998": {
    POS: ["adjective", "adverb"],
    category: "semantic",
    priority: ["8998", "24665"]
  },
  // English future tense
  "8999": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "future", voice: "active", mood: "declarative", form: "finite" }
  },
  // future conditional
  "9000": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "future", voice: "active", mood: "conditional", form: "finite" }
  },
  // future passive
  "9001": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "future", voice: "passive", mood: "declarative", form: "finite" }
  },
  // future passive conditional
  "9002": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "future", voice: "passive", mood: "conditional", form: "finite" }
  },
  // present passive
  "9003": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "present", voice: "passive", mood: "declarative", form: "finite" }
  },
  // English past tense
  "9004": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "past", voice: "active", mood: "declarative", form: "finite" }
  },
  // past conditional
  "9005": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "past", voice: "active", mood: "conditional", form: "finite" }
  },
  // past passive conditional
  "9006": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "past", voice: "passive", mood: "conditional", form: "finite" }
  },
  // past passive
  "9007": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "past", voice: "passive", mood: "declarative", form: "finite" }
  },
  // present passive conditional
  "9008": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "present", voice: "passive", mood: "conditional", form: "finite" }
  },
  // concrete object
  "9009": {
    and: [
      { POS: "noun", category: "grammatical" },
      { TYPE_SHIFT: "concretization", category: "semantic" }
    ]
  },
  // multiple concrete objects
  "9010": {
    and: [
      { POS: "noun", category: "grammatical", features: { number: "plural" } },
      { TYPE_SHIFT: "concretization", category: "semantic" }
    ]
  },
  "9011": {
    category: "grammatical",
    features: { number: "plural" }
  },
  "24667": {
    category: "grammatical",
    features: { definiteness: "definite", number: "singular" },
    notes: "for teaching purposes"
  },
  // female modifier (14166) is preferred; this indicator is rarely used in communication
  "24668": {
    category: "grammatical",
    features: { gender: "feminine", number: "singular" },
    notes: "for teaching purposes",
    equivalent_modifier: "14166",
    priority: ["14166", "24668"]
  },
  "12335": {
    category: "grammatical",
    features: { gender: "masculine", number: "singular" }
  },
  // person indicators are teaching-only; modifiers are used in communication
  "24669": {
    category: "grammatical",
    features: { person: "first-person", number: "singular" },
    notes: "for teaching purposes",
    equivalent_modifier: "8497",
    priority: ["8497", "24669"]
  },
  // past participle form
  "28044": {
    category: "grammatical",
    features: { number: "plural", definiteness: "definite" }
  },
  "28045": {
    and: [
      { category: "grammatical", features: { definiteness: "definite", number: "singular" } },
      { TYPE_SHIFT: "concretization", category: "semantic" }
    ]
  },
  "28046": {
    and: [
      { POS: "noun", category: "grammatical", features: { number: "plural", definiteness: "definite" } },
      { TYPE_SHIFT: "concretization", category: "semantic" }
    ]
  },
  // adverb indicator
  "24665": {
    POS: "adverb",
    category: "grammatical",
    notes: "for teaching purposes",
    priority: ["8998", "24665"]
  },
  // similar to 8993
  "24807": {
    POS: "verb",
    category: "grammatical",
    features: { tense: "present", mood: "declarative", form: "finite" },
    notes: "for teaching purposes",
    priority: ["8993", "24807"]
  },
  // diminutive modifier (28052) is preferred; this indicator is rarely used
  "25458": {
    category: "grammatical",
    features: { size: "diminutive", form: "finite" },
    notes: "for teaching purposes",
    equivalent_modifier: "28052",
    priority: ["28052", "25458"]
  },
  // imperative mood
  "24670": {
    POS: "verb",
    category: "grammatical",
    features: { mood: "imperative", form: "finite" }
  },
  // 3 participles
  "24674": {
    POS: "verb",
    category: "grammatical",
    features: { form: "past-participle-1" },
    notes: "for teaching purposes"
  },
  "24675": {
    POS: "verb",
    category: "grammatical",
    features: { form: "past-participle-2" },
    notes: "for teaching purposes"
  },
  "24677": {
    POS: ["verb", "adjective"],
    category: "grammatical",
    features: { form: "present-participle" },
    notes: "for teaching purposes"
  },
  // back to nouns
  "24671": {
    category: "grammatical",
    features: { definiteness: "indefinite", number: "singular" },
    notes: "for teaching purposes"
  },
  "24672": {
    category: "grammatical",
    features: { gender: "neutral", number: "singular" },
    notes: "for teaching purposes"
  },
  "24678": {
    category: "grammatical",
    features: { person: "second-person", number: "singular" },
    notes: "for teaching purposes",
    equivalent_modifier: "8498",
    priority: ["8498", "24678"]
  },
  "24679": {
    category: "grammatical",
    features: { person: "third-person", number: "singular" },
    notes: "for teaching purposes",
    equivalent_modifier: "8499",
    priority: ["8499", "24679"]
  },
  // continuous indicator
  "28043": {
    POS: "noun",
    category: "grammatical",
    features: { form: "gerund" },
    notes: "Primary indicator for noun-ING (gerunds).",
    priority: ["28043", "8994"]
  },
  // possessive; both indicator (24676) and modifier (12663) are used —
  // modifier preferred in English, indicator preferred in Swedish
  "24676": {
    POS: "noun",
    category: ["grammatical", "syntactical"],
    features: {
      grammatical: { possessive: "possessor" },
      syntactical: { position: ["pre", "post"], "default-position": "post" }
    },
    notes: "for teaching purposes",
    equivalent_modifier: "12663",
    priority: ["12663", "24676"]
  },
  // object form; modifier (28057) is rarely used
  "24673": {
    POS: "noun",
    category: "syntactical",
    features: { position: ["pre", "post"], "default-position": "post" },
    notes: "for teaching purposes",
    equivalent_modifier: "28057",
    priority: ["optional", "24673", "28057"]
  }
};

export const MODIFIER_SEMANTICS: Record<string, ModifierSemantics> = {
  // B314
  "14166": {
    features: {
      gender: "feminine",
      number: "singular",
      position: "suffix",
      "middle-position": "suffix-first-part"
    },
    equivalent_indicator: "24668",
    priority: ["14166", "24668"]
  },
  // B10
  "8497": {
    or: [
      {
        features: {
          person: "first-person",
          number: "singular",
          position: "suffix",
          "middle-position": "suffix-first-part"
        },
        equivalent_indicator: "24669",
        priority: ["8497", "24669"]
      },
      {
        numeric: "one",
        features: { position: "prefix" },
        notes: "default position (prefix) is cardinal; suffixed acts as ordinal"
      }
    ]
  },
  // B11
  "8498": {
    or: [
      {
        features: {
          person: "second-person",
          number: "singular",
          position: "suffix",
          "middle-position": "suffix-first-part"
        },
        equivalent_indicator: "24678",
        priority: ["8498", "24678"]
      },
      {
        features: { numeric: "two", position: "prefix" },
        notes: "default position (prefix) is cardinal; suffixed acts as ordinal"
      }
    ]
  },
  // B12
  "8499": {
    or: [
      {
        features: {
          person: "third-person",
          number: "singular",
          position: "suffix",
          "middle-position": "suffix-first-part"
        },
        equivalent_indicator: "24679",
        priority: ["8499", "24679"]
      },
      {
        features: { numeric: "three", position: "prefix" },
        notes: "default position (prefix) is cardinal; suffixed acts as ordinal"
      }
    ]
  },
  // B5999
  "28052": {
    features: {
      size: "diminutive",
      position: "suffix",
      "middle-position": "suffix-first-part"
    },
    equivalent_indicator: "25458",
    priority: ["28052", "25458"]
  },
  // B112
  "12352": { time: "ago, then (past)", features: { position: "suffix" } },
  // B648
  "17705": { time: "then_future, so, later", features: { position: "suffix" } },
  // B474
  "15736": { time: "now", features: { position: "suffix" } },
  // B233 — combine marker (special structural marker)
  "13382": {
    "structural-marker": "combine marker",
    notes: "combine marker acts like quotation marks surrounding a set of symbols"
  },
  // B699 — what
  "18229": {
    "structural-marker": "what",
    features: { position: "suffix", "middle-position": "suffix-first-part" },
    notes: "interrogative when prefix; specifier when suffix"
  },
  // B401 — intensity
  "14947": {
    degree: "intensity",
    features: { position: "suffix", "middle-position": "suffix-first-part" },
    notes: "exclamatory when prefix; specifier when suffix"
  },
  // B937
  "24879": {
    degree: "more (comparative)",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    notes: "position is prefix in positive context"
  },
  // B968
  "24944": {
    degree: "most (comparative)",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    notes: "position is prefix in positive context"
  },
  // B449/B401
  "15733": {
    negation: "not, negative, no, don't, doesn't",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    priority: ["15474", "15733", "15927"]
  },
  // B486
  "15927": {
    negation: "opposite",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    priority: ["15474", "15733", "15927"]
  },
  // B1060/B578
  "16984": {
    "concept-transforming": "similar to",
    features: { position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B1060/B578/B303
  "16985": {
    "concept-transforming": "look similar to",
    features: { position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B1060/B578/B608
  "16986": {
    "concept-transforming": "sound similar to",
    features: { position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B578/B608
  "16714": {
    "concept-transforming": "same sound",
    features: { position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B348
  "14430": {
    "concept-transforming": "generalization",
    features: { link: "association", position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B449
  "15474": {
    negation: "minus, no, without",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    priority: ["15474", "15733", "15927"]
  },
  // B578
  "16713": {
    relational: "same, equal, equality",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B502/B167
  "12858": {
    relational: "blissymbol part",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B502
  "15972": {
    relational: "part of",
    features: { link: "derivative", position: "prefix", "middle-position": "prefix-second-part" },
    notes: "prefix when 'part of X' (e.g. tonsils → throat); suffix when 'X into parts' (e.g. suit, jigsaw)"
  },
  // B102
  "12324": {
    relational: "about, concerning, regarding, in relation to",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B104
  "12333": { relational: "across", features: { position: "suffix" } },
  // B109
  "12348": {
    relational: "after, behind",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B111
  "12351": {
    relational: "against, opposed to",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    notes: "prefix in most cases; suffix when specifying type"
  },
  // B120/B120
  "12364": { relational: "along with", features: { position: "suffix" } },
  // B162/B368
  "25653": {
    relational: "among",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    notes: "Related: between, to, inside"
  },
  // B134
  "12580": {
    relational: "around",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B135
  "12591": {
    relational: "at",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B158
  "12656": {
    relational: "before, in front of, prior to",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B162
  "12669": {
    relational: "between",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B195
  "13100": {
    relational: "by, by means of, of",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B482
  "15918": {
    relational: "on",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B491
  "15943": {
    relational: "out of (forward)",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    notes: "prefix when motion (something leaves); suffix when direction (outward)"
  },
  // B492
  "15944": { relational: "out of (downward)", features: { position: "suffix" } },
  // B977
  "25134": { relational: "out of (upward)", features: { position: "suffix" } },
  // B976
  "25133": { relational: "out of (backward)", features: { position: "prefix" } },
  // B402
  "14952": {
    relational: "into (forward)",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    notes: "prefix when motion (something enters); suffix when direction (inward)"
  },
  // B1124
  "25895": { relational: "into (downward)", features: { position: "suffix" } },
  // B1125
  "25896": { relational: "into (upward)", features: { position: "suffix" } },
  // B1123
  "25894": { relational: "into (backward)", features: { position: "suffix" } },
  // B490
  "15942": {
    relational: "outside",
    features: { position: "prefix" },
    notes: "prefix if abstract; suffix if physical"
  },
  // B398
  "14932": {
    relational: "inside",
    features: { position: "prefix", "middle-position": "prefix-second-part" },
    notes: "prefix if physical; suffix if abstract"
  },
  // B493
  "15948": {
    relational: "over, above",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B676
  "17969": {
    relational: "under, below",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B1102
  "25628": {
    relational: "under (ground level)",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B331
  "14381": {
    relational: "instead",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B332
  "14382": {
    relational: "for the purpose of, in order to",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B337
  "14403": {
    relational: "from",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B657
  "17739": {
    relational: "to, toward",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B653
  "17724": {
    relational: "through",
    features: { position: "suffix", "middle-position": "prefix-second-part" }
  },
  // B677
  "17982": {
    relational: "until",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    notes: "suffix at final state; prefix at end of cycle-related event"
  },
  // B160
  "12663": {
    relational: "belongs to",
    features: { position: "suffix", "middle-position": "prefix-second-part" },
    equivalent_indicator: "24676",
    priority: ["12663", "24676"]
  },
  // B368
  "14647": {
    quantifier: "many, much",
    features: { position: "prefix", "middle-position": "prefix-second-part" }
  },
  // B117
  "12360": {
    quantifier: "all",
    features: { position: "suffix", "middle-position": "suffix-first-part" }
  },
  // B100
  "12321": { quantifier: "any", features: { position: "prefix" } },
  // B11/B117
  "12879": { quantifier: "both", features: { position: "suffix" } },
  // B10/B117
  "13893": {
    quantifier: "each, every",
    features: { position: "suffix" },
    notes: "suffix inferred from related meanings (both, all)"
  },
  // B286
  "13914": { quantifier: "either", features: { position: "suffix" } },
  // B449/B286
  "15706": {
    quantifier: "neither",
    features: { position: "suffix" },
    notes: "suffix inferred from related meaning: either"
  },
  // B951
  "24906": { quantifier: "half", features: { position: "prefix" } },
  // B962
  "24932": { quantifier: "quarter", features: { position: "prefix" } },
  // B1151
  "26064": { quantifier: "one third", features: { position: "prefix" } },
  // B1152
  "26065": { quantifier: "two thirds", features: { position: "prefix" } },
  // B1153
  "26066": { quantifier: "three quarters", features: { position: "prefix" } },
  // B559/B11
  "16762": {
    quantifier: "several",
    features: { position: "prefix" },
    notes: "prefix inferred from related meaning: many/much"
  },
  // B9
  "8496": {
    numeric: "zero",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B13
  "8500": {
    numeric: "four",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B14
  "8501": {
    numeric: "five",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B15
  "8502": {
    numeric: "six",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B16
  "8503": {
    numeric: "seven",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B17
  "8504": {
    numeric: "eight",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  },
  // B18
  "8505": {
    numeric: "nine",
    features: { position: "prefix" },
    notes: "prefix is cardinal; suffix is ordinal"
  }
};
