/*
 * Copyright 2023-2025 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/inclusive-design/adaptive-palette/blob/main/LICENSE
 */

/**
 * Populate and export global data
 */
import { signal } from "@preact/signals";

// NOTE: this import causes a warning serving the application using the `vite`
// server.  The warning suggests to *not* us the `public` folder but to use
// the `src` folder instead.  However, this code is also served using node
// express and it is in the proper location for that envionment.  A copy of the
// warning follows:
// "Assets in public directory cannot be imported from JavaScript.
//  If you intend to import that asset, put the file in the src directory, and use /src/data/bliss_symbol_explanations.json instead of /public/data/bliss_symbol_explanations.json.
//  If you intend to use the URL of that asset, use /data/bliss_symbol_explanations.json?url.
//  Files in the public directory are served at the root path.
//  Instead of /public/data/bliss_symbol_explanations.json, use /data/bliss_symbol_explanations.json."
import bliss_symbols from "../../public/data/bliss_symbol_explanations.json";

/**
 * The map between cell types (string) and actual components that render corresponding cells
 */
import { ActionBmwCodeCell } from "./ActionBmwCodeCell";
import { ActionBranchToPaletteCell } from "./ActionBranchToPaletteCell";
import { ActionIndicatorCell } from "./ActionIndicatorCell";
import { ActionRemoveIndicatorCell } from "./ActionRemoveIndicatorCell";
import { CommandGoBackCell } from "./CommandGoBackCell";
import { ContentBmwEncoding } from "./ContentBmwEncoding";
import { CommandClearEncoding } from "./CommandClearEncoding";
import { CommandDelLastEncoding } from "./CommandDelLastEncoding";
import { PaletteStore } from "./PaletteStore";
import { NavigationStack } from "./NavigationStack";

export const cellTypeRegistry = {
  "ActionBmwCodeCell": ActionBmwCodeCell,
  "ActionBranchToPaletteCell": ActionBranchToPaletteCell,
  "ActionIndicatorCell": ActionIndicatorCell,
  "ActionRemoveIndicatorCell": ActionRemoveIndicatorCell,
  "CommandGoBackCell": CommandGoBackCell,
  "ContentBmwEncoding": ContentBmwEncoding,
  "CommandClearEncoding": CommandClearEncoding,
  "CommandDelLastEncoding": CommandDelLastEncoding
};

/**
 * Load the map between the BCI-AV IDs and the code consumed by the Bliss SVG
 * and create the PaletterStore and NavigationStack objects.
 */
export const adaptivePaletteGlobals = {
  // The map between the BCI-AV IDs and the code consumed by the Bliss SVG
  // builder.  The map itself is set asynchronously.
  blissaryIdMapUrl: "https://raw.githubusercontent.com/hlridge/Bliss-Blissary-BCI-ID-Map/main/blissary_to_bci_mapping.json",
  blissaryIdMap: null,
  bciAvSymbols: bliss_symbols,
  paletteStore: new PaletteStore(),
  navigationStack: new NavigationStack(),

  // `id` attribute of the HTML element area where the main palette is
  // displayed, set by initAdaptivePaletteGlobals().  It defaults to the empty
  // string and that identifies the `<body>` elements as a default.
  //
  mainPaletteContainerId: ""
};

export async function loadBlissaryIdMap (): Promise<object> {
  const response = await fetch(adaptivePaletteGlobals.blissaryIdMapUrl);
  return await response.json();
}

/**
 * Initialize the `adaptivePaletteGlobals` structure.
 * @param {HTMLElement} mainPaletteContainerId  - Optional argument specifying
 *                                                the id of a container element,
 *                                                e.g., a `<div>` element, to
 *                                                use for rendering the the
 *                                                main paletted Defaults to the
 *                                                empty string which denotes
 *                                                the `<body>delement.
 */
export async function initAdaptivePaletteGlobals (mainPaletteContainerId?:string): Promise<void> {
  adaptivePaletteGlobals.blissaryIdMap = await loadBlissaryIdMap();
  adaptivePaletteGlobals.mainPaletteContainerId = mainPaletteContainerId || "";
}

/**
 * Signal for updating the contents of the ContentBmwEncoding area.  The value
 * of the signal is the current array of EncodingType objects to display in the
 * ContentBmwEncoding area, an empty array to begin with.
 */
export const changeEncodingContents = signal([]);
