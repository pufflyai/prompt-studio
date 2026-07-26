import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Review mode"
    title="Change review"
    description="Review owns a separate Main, Secondary, and Side Panel arrangement."
    details={[
      "Inspect changes in Main",
      "Keep checks below",
      "Use Switch Mode in the Command Palette to compare layouts",
    ]}
    colorPalette="yellow"
  />
));
