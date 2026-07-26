import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Main right menu"
    title="Inspector"
    description="This Panel menu is reused across Coding, Design, and Review mode scopes."
    details={["Active surface", "Mode-owned placement", "Restored independently"]}
    colorPalette="blue"
  />
));
