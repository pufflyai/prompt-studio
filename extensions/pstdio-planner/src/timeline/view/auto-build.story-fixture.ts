import { DEFAULT_STATUSES } from "../../data/seed";
import type { AutoBuildFormProps } from "./auto-build-form";

export const autoBuildStoryConfiguration: Omit<AutoBuildFormProps, "onClose" | "t"> = {
  saving: false,
  requireMergedDependencies: false,
  eligible: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
  prompt: "Implement the calculator feature.",
  ignore: { conjunction: "and", rules: [] },
  data: {
    rows: [],
    attributes: [
      { id: "title", label: "Title", filterable: true, type: { kind: "string" } },
      {
        id: "status",
        label: "Status",
        filterable: true,
        type: {
          kind: "enum",
          options: DEFAULT_STATUSES.map((status) => ({
            value: status.id,
            label: status.name,
            icon: status.icon,
            color: status.color,
          })),
        },
      },
    ],
    storageKey: "auto-build-story",
  },
  onEnable: async () => true,
};
