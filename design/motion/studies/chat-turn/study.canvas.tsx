import { motionCanvas } from "../../canvas-study";
import Scene from "./scene";
import study from "./study.json";

export default { ...motionCanvas(study, Scene), title: "Design system/Patterns/Motion/Chat/Chat turn" };
export const Instant = { args: { preset: "instant", turn: "spinner" } };
export const Subtle = { args: { preset: "subtle" } };
