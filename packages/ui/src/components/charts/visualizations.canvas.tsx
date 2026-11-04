import type { CanvasMeta } from "@pstdio/canvas";
import { VisualizationGallery } from "./visualization-gallery";

export default { title: "Foundations/Visualizations", fullscreen: true } satisfies CanvasMeta;
export const Light = { render: () => <VisualizationGallery />, defaultTheme: "pstdio-light" };
export const Dark = { render: () => <VisualizationGallery />, defaultTheme: "pstdio-dark" };
export const CustomPalette = { render: () => <VisualizationGallery />, defaultTheme: "charts-forest" };
