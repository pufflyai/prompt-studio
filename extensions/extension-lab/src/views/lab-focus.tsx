import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Focus mode"
    title="Main only"
    description="Focus removes every optional Panel while keeping mode recovery available through the command palette."
    details={[
      "Main Panel available",
      "Secondary and Side Panels unavailable",
      "Use Switch Mode in the Command Palette to leave Focus",
    ]}
    colorPalette="orange"
  />
));
