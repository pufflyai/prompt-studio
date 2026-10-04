import { useEffect, useState } from "react";
import type { ShaderValues } from "./definitions";

interface NoiseMaskProps {
  id: string;
  values: ShaderValues;
  width: number;
  height: number;
}

// Rasterize turbulence only when its inputs change. Frames move the cached pixels.
export const NoiseMask = (props: NoiseMaskProps) => {
  const { id, values, width, height } = props;
  const { noiseScale, noiseContrast, noiseBalance, noiseDetail, seed } = values;
  const tile = Math.ceil(Math.max(width, noiseScale * 4));
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    const channel = `${noiseContrast} 0 0 0 ${0.5 - 0.5 * noiseContrast + noiseBalance}`;
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${Math.ceil(height)}"><filter id="noise" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${1 / noiseScale}" numOctaves="${noiseDetail}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${channel} ${channel} ${channel} 0 0 0 0 1"/></filter><rect width="100%" height="100%" filter="url(#noise)"/></svg>`;
    const raster = new Image();
    raster.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas");
      canvas.width = tile;
      canvas.height = Math.ceil(height);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(raster, 0, 0);
      setImage(canvas.toDataURL());
    };
    raster.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
    return () => {
      active = false;
    };
  }, [tile, height, noiseScale, noiseContrast, noiseBalance, noiseDetail, seed]);
  return (
    <defs>
      <mask id={`${id}-noise`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
        <g data-motion="noise">
          {image && (
            <>
              <image href={image} width={tile} height={height} />
              <image href={image} x={tile} width={tile} height={height} />
            </>
          )}
        </g>
      </mask>
    </defs>
  );
};
