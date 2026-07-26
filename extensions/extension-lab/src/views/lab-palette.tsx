import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Main left menu"
    title="Design palette"
    description="Design replaces the Coding menu within its own saved layout scope."
    details={["Components", "Tokens", "Assets"]}
    colorPalette="green"
  />
));
