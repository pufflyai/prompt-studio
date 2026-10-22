import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type { WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";

// A scripted harness catalog: the testbench never talks to real harnesses, but
// webviews that embed harness controls still need choices to render.
const params = {
  effort: {
    type: "select" as const,
    label: "Reasoning effort",
    defaultValue: "medium",
    options: [
      { label: "Low", value: "low", icon: "level-low" },
      { label: "Medium", value: "medium", icon: "level-mid" },
      { label: "High", value: "high", icon: "level-high" },
    ],
  },
};

const harnesses = [
  {
    id: "bench.harness.scripted",
    name: "Scripted harness",
    availability: { type: "INSTALLED" as const },
    capabilities: [],
    supportsModels: true,
    params,
  },
];

const models = [
  { id: "bench-fast", label: "Bench fast", isDefault: true, paramOverrides: { effort: null } },
  { id: "bench-deep", label: "Bench deep" },
];

export const readBenchHarnesses = (input: WebviewHostCapabilityParams["harnesses.read"]) => {
  const selected = harnesses.find((harness) => harness.id === input.harnessId) ?? harnesses[0];
  const model = findAgentModel(models, models.some(({ id }) => id === input.model) ? input.model : undefined);
  const schema = resolveAgentModelParams(selected.params, model) ?? undefined;
  return {
    harnesses,
    models,
    schema,
    defaults: Object.fromEntries(
      Object.entries(schema ?? {}).flatMap(([key, param]) => (param.defaultValue ? [[key, param.defaultValue]] : [])),
    ),
    selection: { harnessId: selected.id, ...(model ? { model: model.id } : {}) },
  };
};
