import type { MarmaladeLayer } from "./marmalade.types";
import { greatWaveImage } from "./marmalade-preview";
import { MarmaladeSvgArtwork } from "./marmalade-svg-artwork";

export const MarmaladeArtwork = (props: { layer: MarmaladeLayer }) => (
  <MarmaladeSvgArtwork layer={props.layer} imageHref={greatWaveImage} />
);
