import { shaderCanvas } from "../library/canvas-preview";
import config from "./default.json";

export default {
  ...shaderCanvas("dots-to-grid", config),
  title: "Shaders/Dots to grid",
  save: { file: "default.json", key: "values" },
};
export const Preview = {};
export const Compare = { defaultTheme: "pstdio-dark" };
