import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Design mode"
    title="Prototype canvas"
    description="Main and Side Panels remain available while Sidenav and Secondary Panel are absent."
    details={[
      "Edit the Main layout",
      "Open or close its menus",
      "Use Switch Mode in the Command Palette, then return to restore this arrangement",
    ]}
    colorPalette="green"
  />
));
