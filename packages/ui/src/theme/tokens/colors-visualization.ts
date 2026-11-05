import { chartAlerts, chartCategorical, chartDiverging, chartSequential } from "../primitives/chart-palettes";

const steps = ["low-3", "low-2", "low-1", "default", "high-1", "high-2", "high-3"];
const modeColor = (light: string, dark: string) => ({ value: { _light: light, _dark: dark } });

export const vis = {
  text: {
    primary: {
      value: {
        _light: "{colors.blacks.800}",
        _dark: "{colors.blacks.200}",
      },
    },
    secondary: {
      value: {
        _light: "{colors.blacks.600}",
        _dark: "{colors.blacks.500}",
      },
    },
  },

  grid: {
    value: {
      _light: "{colors.blacks.300}",
      _dark: "{colors.blacks.800}",
    },
  },

  axis: {
    value: {
      _light: "{colors.blacks.700}",
      _dark: "{colors.blacks.300}",
    },
  },

  categorical: Object.fromEntries(
    chartCategorical.light.map((light, index) => [index + 1, modeColor(light, chartCategorical.dark[index])]),
  ),
  sequential: Object.fromEntries(
    Object.entries(chartSequential).map(([name, ramp]) => [
      name,
      Object.fromEntries(steps.map((step, index) => [step, modeColor(ramp[index], ramp[ramp.length - index - 1])])),
    ]),
  ),
  diverging: Object.fromEntries(
    Object.entries(chartDiverging).map(([name, ramp]) => [
      name,
      Object.fromEntries(ramp.map((color, index) => [index + 1, { value: color }])),
    ]),
  ),
  alert: Object.fromEntries(
    ["danger", "seriousWarning", "warning", "success"].map((name, index) => [
      name,
      modeColor(chartAlerts.light[index], chartAlerts.dark[index]),
    ]),
  ),
};
