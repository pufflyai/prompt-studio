import { renderToStaticMarkup } from "react-dom/server";
import type { MarmaladeState } from "./marmalade.types";
import { marmaladeLayers } from "./marmalade-layers";
import { MarmaladeSvgArtwork } from "./marmalade-svg-artwork";

/** Export authored document coordinates; selection, zoom and pan belong only to the editor. */
export const marmaladeSvg = (state: MarmaladeState, imageHref: string) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={state.document.width}
      height={state.document.height}
      viewBox={`0 0 ${state.document.width} ${state.document.height}`}
    >
      <title>{state.document.title}</title>
      {marmaladeLayers(state).map((layer) => (
        <g
          key={layer.id}
          opacity={layer.opacity}
          transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation ?? 0} ${layer.width / 2} ${layer.height / 2})`}
        >
          <MarmaladeSvgArtwork layer={layer} imageHref={imageHref} />
        </g>
      ))}
    </svg>,
  );
