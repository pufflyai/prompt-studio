import {
  type ControlGroup,
  type ControlValueMap,
  defineExtension,
  definePage,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

let values: ControlValueMap = {
  environment: "staging",
  replicas: 2,
  releaseNotes: "Check the worker queue after deployment.",
};
const deploymentGroups: ControlGroup[] = [
  {
    id: "deployment",
    title: "Deployment",
    description: "Values returned by the extension, rendered with shared workbench controls.",
    params: [
      {
        id: "environment",
        name: "Environment",
        type: "selection",
        defaultValue: "staging",
        options: [
          { id: "staging", name: "Staging" },
          { id: "production", name: "Production" },
        ],
      },
      { id: "replicas", name: "Replicas", type: "number", defaultValue: 2, min: 1, max: 10, step: 1 },
      { id: "releaseNotes", name: "Release notes", type: "text", defaultValue: "", singleLine: false },
    ],
  },
];
const deploymentSettings = defineView({
  id: "deployment-settings",
  title: "Deployment settings",
  body: {
    kind: "controls",
    query: async () => ({
      groups: deploymentGroups,
      values,
    }),
    onValueChange: async (_ctx, input) => {
      values = { ...values, [input.controlId]: input.value };
    },
  },
});
export const deploymentSettingsPage = definePage({
  id: "deployment-settings",
  title: "Deployment settings",
  path: "deployment-settings",
  mode: workbenchModes.project,
  main: {
    kind: "view",
    view: deploymentSettings.ref,
    cardinality: "one",
  },
  slots: [],
});
export default defineExtension({
  views: [deploymentSettings],
  pages: [deploymentSettingsPage],
});
