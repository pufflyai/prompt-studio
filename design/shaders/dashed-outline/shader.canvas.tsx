import { shaderCanvas } from "../library/canvas-preview";
import config from "./default.json";

export default {
  ...shaderCanvas("dashed-outline", config),
  title: "Shaders/Dashed outline",
  save: { file: "default.json", key: "values" },
};
export const Preview = {};
export const Compare = { defaultTheme: "pstdio-dark" };
