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

import { html } from "htm/preact";
import { BlissCellType } from "./index.d";
import { BlissSymbol } from "./BlissSymbol";
import "./ActionBmwCodeCell.scss";
import { usePaletteState } from "./GlobalData";


type ActionBmwCodeCellPropsType = {
  id: string,
  options: BlissCellType
};

export function ActionBmwCodeCell (props: ActionBmwCodeCellPropsType) {
  // Using separate lines to get "fullEncoding" & "setFullEncoding" rather than using one single line:
  // { fullEncoding, setFullEncoding } = usePaletteState();
  // is to accommodate the component unit test in which the parent palette component is not tested. The
  // palette state is defined in the palette context.
  const paletteState = usePaletteState();
  const fullEncoding = paletteState?.fullEncoding;
  const setFullEncoding = paletteState?.setFullEncoding;

  const {
    columnStart, columnSpan, rowStart, rowSpan, bciAvId, label
  } = props.options;

  const gridStyles = `
    grid-column: ${columnStart} / span ${columnSpan};
    grid-row: ${rowStart} / span ${rowSpan};
  `;

  const cellClicked = () => {
    const payload = {
      "id": props.id,
      "label": props.options.label,
      "bciAvId": props.options.bciAvId
    };
    setFullEncoding([...fullEncoding, payload]);
  };

  return html`
    <button id="${props.id}" class="actionBmwCodeCell" style="${gridStyles}" onClick=${cellClicked}>
      <${BlissSymbol}
        bciAvId=${bciAvId}
        label=${label}
        isPresentation=true
      />
    </button>
  `;
}
