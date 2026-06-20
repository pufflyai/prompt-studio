import { clampMermaidZoom } from "./mermaid-zoom";
import { createSvgDataUrl, resolveSvgSize } from "./svg-data-url";

interface DownloadMermaidPngOptions {
  svg: string;
  zoom: number;
  filename?: string;
}

const loadImage = (url: string) =>
  new Promise<{ image: HTMLImageElement; cleanup: () => void }>((resolve, reject) => {
    const image = new Image();
    image.style.position = "fixed";
    image.style.left = "-10000px";
    image.style.top = "0";
    image.style.pointerEvents = "none";
    image.onload = () => resolve({ image, cleanup: () => image.remove() });
    image.onerror = () => {
      image.remove();
      reject(new Error("Failed to load rendered Mermaid SVG for PNG export."));
    };
    document.body.append(image);
    image.src = url;
  });

const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to encode Mermaid diagram as PNG."));
    }, "image/png");
  });

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadMermaidPng = async (options: DownloadMermaidPngOptions) => {
  const { svg, zoom, filename = "mermaid-diagram.png" } = options;
  const svgUrl = createSvgDataUrl(svg);

  const { image, cleanup } = await loadImage(svgUrl);
  try {
    const { width, height } = resolveSvgSize(svg);
    const scale = clampMermaidZoom(zoom);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering is unavailable for Mermaid PNG export.");
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    triggerDownload(await canvasToPngBlob(canvas), filename);
  } finally {
    cleanup();
  }
};
