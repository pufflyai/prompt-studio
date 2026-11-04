import { motionCanvas } from "../../canvas-study";
import Scene from "./scene";
import study from "./study.json";

export default { ...motionCanvas(study, Scene), title: "Motion/Workbench/Row creation" };
export const Instant = { args: { preset: "instant" } };
export const Subtle = { args: { preset: "subtle" } };
