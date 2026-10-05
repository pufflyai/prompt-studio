import { useEffect, useState } from "react";
import type { ShaderValues } from "./definitions";
import { noiseTile } from "./motion";

// Rasterize only when inputs change. Alpha lets CSS mask the cached tile directly.
export const useNoiseImage = (values: ShaderValues, width: number, height: number) => {
  const { noiseScale, noiseContrast, noiseBalance, noiseDetail, seed } = values;
  const tile = noiseTile(width, noiseScale);
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!width || !height) return;
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
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = pixels.data[i];
      context.putImageData(pixels, 0, 0);
      setImage(canvas.toDataURL());
    };
    raster.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
    return () => {
      active = false;
    };
  }, [tile, width, height, noiseScale, noiseContrast, noiseBalance, noiseDetail, seed]);
  return image;
};
