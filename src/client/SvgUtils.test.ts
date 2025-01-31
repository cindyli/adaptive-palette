/*
 * Copyright 2023-2024 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/inclusive-design/adaptive-palette/blob/main/LICENSE
 */
import { initAdaptivePaletteGlobals, adaptivePaletteGlobals } from "./GlobalData";
import {
  bciToBlissaryId, bciAvIdToString, makeBciAvIdType, isIndicatorId,
  findIndicators, isModifierId, findClassifierFromLeft, findBciAvSymbol,
  decomposeBciAvId, BLISSARY_PATTERN_KEY, BCIAV_PATTERN_KEY
} from "./SvgUtils";

describe("SvgUtils module", (): void => {

  // The `singleBciAvId` is taken from the BMW json for "CONJ." The
  // `bciAvIdArray` is also from the BMW json file using the codes for
  // "VERB+EN".  The `expectedX` constants are based on a manual lookup of the
  // blissary ids.
  const singleBciAvId = 23409;                        // CONJ.
  const expectedString = "B823";
  const bciAvIdArray = [ 12335, "/", 8499 ];          // VERB+EN
  const expectedConcatenation = "B106/B12";
  const invalidBciAvId = 1;
  const reviveBlissarySvgBuilderStr = "B206;B81/K:-2/B473/B457";
  const expectedBciAvIdRevive = [
    13134, ";", 8993, "/", "K:-2", "/", 15732, "/", 15666
  ];
  const reviveBciSvgBuilderStr = "13134;8993/K:-2/15732/15666";
  const abcBlissarySvgBuilderStr = "Xa/Xb/Xc";        // "a b c"
  const abcBciAvSvgBuilderStr    = "Xa/Xb/Xc";        // "a b c"
  const expectedBciAvIdAbc = [ "Xa", "/", "Xb", "/", "Xc" ];
  const indicatorId = 8999;                           // future action indicator
  const nonIndicatorId = 12334;                       // action
  const modifierId = 8515;                            // "5" (5 items or 5th)
  const nonModifierId = 28043;                        // continuous indicator
  const dontKnow = [ 15161, "/", 15733];
  const fullDontKonw = [15162,";",8993,"/",15474,"/",14947];

  // Github test runs suggested that more that 5000 msec was needed for these
  // tests, so increased timeout to 7000.
  beforeAll(async () => {
    await initAdaptivePaletteGlobals();
  }, 7000);

  test("Retrieve blissary id from BCI-AV-ID", (): void => {
    const { blissaryIdMap } = adaptivePaletteGlobals;

    // Use the 100th entry in the map for testing.  There is nothing special
    // about the 100th entry.  Just as good as any.
    const blissaryIdMapEntry = blissaryIdMap[100];

    const result = bciToBlissaryId(blissaryIdMapEntry.bciAvId);
    expect(result.blissaryId).toBe(blissaryIdMapEntry.blissaryId);
  });

  test("No blissary id for unknown BCI-AV-ID", (): void => {
    expect(bciToBlissaryId(invalidBciAvId)).toBe(undefined);
  });

  test("Create svg builder argument", (): void => {
    let result = bciAvIdToString(singleBciAvId);
    expect(result).toBe(expectedString);

    result = bciAvIdToString(bciAvIdArray);
    expect(result).toBe(expectedConcatenation);
  });

  test("Unknown BCI-AV-ID", (): void => {
    expect(() => { bciAvIdToString(invalidBciAvId); }).toThrow();
  });

  test("Create a BciAvIdType from a Blissry SVG builder string", (): void => {
    expect(makeBciAvIdType(reviveBlissarySvgBuilderStr)).toEqual(expectedBciAvIdRevive);
    expect(makeBciAvIdType(abcBlissarySvgBuilderStr)).toEqual(expectedBciAvIdAbc);
    // Using blissary pattern key, explicitly
    expect(makeBciAvIdType(reviveBlissarySvgBuilderStr, BLISSARY_PATTERN_KEY)).toEqual(expectedBciAvIdRevive);
    expect(makeBciAvIdType(abcBlissarySvgBuilderStr, BLISSARY_PATTERN_KEY)).toEqual(expectedBciAvIdAbc);
  });

  test("Create a BciAvIdType from a BCI-AV SVG builder string", (): void => {
    expect(makeBciAvIdType(reviveBciSvgBuilderStr, BCIAV_PATTERN_KEY)).toEqual(expectedBciAvIdRevive);
    expect(makeBciAvIdType(abcBciAvSvgBuilderStr, BCIAV_PATTERN_KEY)).toEqual(expectedBciAvIdAbc);
  });

  test("Check for indicator or modifier BCI-AV-ID", (): void => {
    expect(isIndicatorId(indicatorId)).toEqual(true);
    expect(isIndicatorId(nonIndicatorId)).toEqual(false);
    expect(isModifierId(modifierId)).toEqual(true);
    expect(isModifierId(nonModifierId)).toEqual(false);
  });

  test("Find indicator positions", (): void => {
    // The test BCI-AV-ID `expectedBciAvIdRevive` contains an action indicator
    // over the first symbol "cause".
    let indicatorPositions = findIndicators(expectedBciAvIdRevive);
    expect(indicatorPositions.length).toEqual(1);
    expect(indicatorPositions).toEqual([2]);

    // `expectedBciAvIdAbc` has no indictors.  `singleBciAvId` is a single
    // number BCI-AV-ID and has no indicators.
    indicatorPositions = findIndicators(expectedBciAvIdAbc);
    expect(indicatorPositions.length).toEqual(0);
    indicatorPositions = findIndicators(singleBciAvId);
    expect(indicatorPositions.length).toEqual(0);
  });

  test("Find first symbol after a modifier", (): void => {
    // Prefix the `expectedBciAvIdRevive` with the `modifierId` modifier.
    let modifiedRevive = [modifierId, "/", ...expectedBciAvIdRevive];
    expect(findClassifierFromLeft(modifiedRevive)).toEqual(2);

    // Prefix again with two modifiers and a modifier suffix.
    modifiedRevive = [modifierId, "/", modifierId, "/", ...expectedBciAvIdRevive, "/", modifierId];
    expect(findClassifierFromLeft(modifiedRevive)).toEqual(4);

    // The original `expectedBciAvIdRevive` has no modifiers; also a single
    // BCI-AV-ID has no modifiers (or it is one).
    expect(findClassifierFromLeft(expectedBciAvIdRevive)).toEqual(0);
    expect(findClassifierFromLeft(singleBciAvId)).toEqual(0);
  });

  test("Check finding full symbol information", (): void => {
    let actual = findBciAvSymbol(singleBciAvId);
    expect(parseInt(actual.id)).toBe(singleBciAvId);

    // Passing an invalid BCI AV Identifier or the array form of BciAvIdType
    // should return `undefined`
    actual = findBciAvSymbol(invalidBciAvId);
    expect(actual).toEqual(undefined);
    actual = findBciAvSymbol(bciAvIdArray);
    expect(actual).toEqual(undefined);
  });

  test("Deompositon checks for single ID, invalid ID, and array", (): void => {
    expect(decomposeBciAvId(singleBciAvId)).toEqual([singleBciAvId]);
    expect(decomposeBciAvId(invalidBciAvId)).toEqual(undefined);
    expect(decomposeBciAvId(bciAvIdArray)).toEqual(bciAvIdArray);
    expect(decomposeBciAvId(dontKnow)).toEqual(fullDontKonw);
  });
});
