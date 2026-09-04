import { defineExtension, definePage, defineView, type JsonValue, workbenchModes } from "@pstdio/sdk/extensions";

let values: Record<string, JsonValue> = {
  environment: "staging",
  replicas: 2,
  releaseNotes: "Check the worker queue after deployment.",
};

const deploymentGroups: JsonValue[] = [
  {
    id: "deployment",
    title: "Deployment",
    description: "Values returned by the extension, rendered with shared workbench controls.",
    params: [
      {
        id: "environment",
        name: "Environment",
        type: "selection",
        options: [
          { id: "staging", name: "Staging" },
          { id: "production", name: "Production" },
        ],
      },
      { id: "replicas", name: "Replicas", type: "number", min: 1, max: 10, step: 1 },
      { id: "releaseNotes", name: "Release notes", type: "text", singleLine: false },
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
  slots: [{ id: "content", role: "primary", region: "main", view: deploymentSettings.ref }],
});

export default defineExtension({
  views: [deploymentSettings],
  pages: [deploymentSettingsPage],
});
