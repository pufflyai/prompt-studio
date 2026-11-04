import { motionCanvas } from "../../canvas-study";
import Scene from "./scene";
import study from "./study.json";

export default { ...motionCanvas(study, Scene), title: "Motion/Chat/Tools and follow-ups" };
export const Instant = { args: { preset: "instant", loader: "spinner" } };
export const Subtle = { args: { preset: "subtle" } };
