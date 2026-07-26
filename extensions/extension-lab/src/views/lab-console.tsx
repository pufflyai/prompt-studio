import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Secondary Panel"
    title="Experiment console"
    description="Coding seeds a Secondary Panel and restores its size when the mode returns."
    details={["Mode: Coding", "Panel: Secondary", "Placement: below Main"]}
    colorPalette="green"
  />
));
