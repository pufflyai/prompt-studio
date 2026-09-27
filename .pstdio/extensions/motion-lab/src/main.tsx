import { createView } from "./create-view";
export default createView(async () => (await import("./motion-preview")).MotionPreview);
