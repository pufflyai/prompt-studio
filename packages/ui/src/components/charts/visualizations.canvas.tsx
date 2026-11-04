import type { CanvasMeta } from "@pstdio/canvas";
import { VisualizationFrame } from "./visualization-frame";
import { VisualizationGallery } from "./visualization-gallery";
import { PaletteExamples } from "./visualization-palettes";
import { PieExamples } from "./visualization-parts";
import { AreaExamples, LineExamples } from "./visualization-trends";

export default { title: "Foundations/Visualizations", fullscreen: true } satisfies CanvasMeta;
export const Light = { render: () => <VisualizationGallery />, defaultTheme: "pstdio-light" };
export const Dark = { render: () => <VisualizationGallery />, defaultTheme: "pstdio-dark" };
export const CustomPalette = { render: () => <VisualizationGallery />, defaultTheme: "charts-forest" };

export const PieCharts = () => (
  <VisualizationFrame title="Pie and donut charts">
    <PieExamples />
  </VisualizationFrame>
);
export const AreaCharts = () => (
  <VisualizationFrame title="Area charts">
    <AreaExamples />
  </VisualizationFrame>
);
export const LinePlots = () => (
  <VisualizationFrame title="Line plots">
    <LineExamples />
  </VisualizationFrame>
);
export const Palettes = () => (
  <VisualizationFrame title="Visualization palettes">
    <PaletteExamples />
  </VisualizationFrame>
);
