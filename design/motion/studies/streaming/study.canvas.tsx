import { motionCanvas } from "../../canvas-study";
import Scene from "./scene";
import study from "./study.json";

export default { ...motionCanvas(study, Scene), title: "Motion/Chat/Streaming text" };
export const Instant = { args: { preset: "instant", streaming: "append" } };
export const Subtle = { args: { preset: "subtle" } };
