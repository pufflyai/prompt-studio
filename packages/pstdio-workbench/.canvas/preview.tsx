import "@pstdio/ui/style.css";
import "./preview.css";
import type { CanvasPreview } from "@pstdio/canvas";

// Theming is owned by the workbench: `Workbench` reads `workbench.themes` and
// mounts its own `WorkbenchThemeProvider`. Stories add no theme decorator.
const preview: CanvasPreview = {};
export default preview;
