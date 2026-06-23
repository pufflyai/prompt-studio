export const MERMAID_MIN_ZOOM = 0.5;
export const MERMAID_MAX_ZOOM = 3;
export const MERMAID_ZOOM_STEP = 0.25;

export const clampMermaidZoom = (value: number) =>
  Number(Math.min(MERMAID_MAX_ZOOM, Math.max(MERMAID_MIN_ZOOM, value)).toFixed(2));

export const zoomIn = (zoom: number) => clampMermaidZoom(zoom + MERMAID_ZOOM_STEP);

export const zoomOut = (zoom: number) => clampMermaidZoom(zoom - MERMAID_ZOOM_STEP);
