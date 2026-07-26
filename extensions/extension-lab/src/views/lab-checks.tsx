import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Secondary Panel"
    title="Review checks"
    description="Review seeds different Secondary content from Coding."
    details={["Types: passing", "Tests: passing", "Design: ready"]}
    colorPalette="yellow"
  />
));
