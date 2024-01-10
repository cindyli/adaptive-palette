/*
 * Copyright 2024 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/inclusive-design/adaptive-palette/blob/main/LICENSE
 */

import { getGridStyle } from "./GlobalUtils";

describe("Test global utility functions", () => {

  test("Test getGridStyle()", () => {
    expect(getGridStyle(2, 1, 3, 2)).toBe("grid-column: 2 / span 1;grid-row: 3 / span 2;");
    expect(getGridStyle(undefined, undefined, undefined, undefined)).toBe("grid-column: undefined / span undefined;grid-row: undefined / span undefined;");
  });
});
