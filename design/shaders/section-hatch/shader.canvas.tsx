import { shaderCanvas } from "../library/canvas-preview";
import config from "./default.json";

export default {
  ...shaderCanvas("section-hatch", config),
  title: "Shaders/Section hatch",
  save: { file: "default.json", key: "values" },
};
export const Preview = {};
export const Compare = { defaultTheme: "pstdio-dark" };
