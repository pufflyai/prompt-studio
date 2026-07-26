import { LabModeSurface } from "../components/lab-mode-surface";
import { createLabView } from "../renderers/lab-view-shell";

export default createLabView(() => (
  <LabModeSurface
    eyebrow="Main left menu"
    title="Coding tools"
    description="A pinned Panel menu contributed by the active mode."
    details={["Files", "Symbols", "Experiments"]}
  />
));
