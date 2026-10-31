import "@pstdio/ui/style.css";
import "./preview.css";
import type { CanvasProject } from "@pstdio/canvas";

// Theming is owned by the workbench: `Workbench` reads `workbench.themes` and
// mounts its own `WorkbenchThemeProvider`. Stories add no theme decorator.
const preview: CanvasProject = {};
export default preview;
