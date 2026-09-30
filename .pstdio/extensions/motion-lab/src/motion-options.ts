import type { InputGroup, Param } from "@pstdio/ui/param-editor";
import type { StudyProps } from "./kit/model";
import type { StudyMetadata } from "./study-schema";

const presets = [
  { id: "instant", name: "Instant" },
  { id: "subtle", name: "Subtle" },
  { id: "slower", name: "Slower" },
];
const variantGroup = (side: "left" | "right", title: string, settings: StudyProps, study: StudyMetadata) => {
  const variant = settings[side];
  const params: Param[] = [
    {
      id: `${side}.preset`,
      name: "Preset",
      type: "segmented",
      defaultValue: variant.preset,
      options: presets,
      description: "Instant removes transitions. Slower uses 1.5× transition durations without changing event times.",
    },
  ];
  for (const param of study.params)
    params.push({
      id: `${side}.${param.id}`,
      name: param.name,
      type: param.type,
      description: param.description,
      options: param.options,
      defaultValue: variant.values[param.id] ?? param.default[side],
    });
  return { id: side, title, params };
};
export const optionGroups = (settings: StudyProps, study: StudyMetadata) =>
  [
    {
      id: "view",
      title: "Preview",
      params: [
        {
          id: "comparison",
          name: "View",
          type: "segmented",
          defaultValue: settings.comparison ? "compare" : "single",
          options: [
            { id: "single", name: "Single" },
            { id: "compare", name: "Compare" },
          ],
        },
        {
          id: "theme",
          name: "Theme",
          type: "segmented",
          defaultValue: settings.theme,
          options: [
            { id: "dark", name: "Dark" },
            { id: "light", name: "Light" },
          ],
        },
        {
          id: "reducedMotion",
          name: "Reduced motion",
          type: "boolean",
          defaultValue: settings.reducedMotion,
          description: "Remove travel, animated resizing, and loader motion. Keep content and status visible.",
        },
      ],
    },
    ...(settings.comparison ? [variantGroup("left", "Left preview", settings, study)] : []),
    variantGroup("right", settings.comparison ? "Right preview" : "Animation", settings, study),
    {
      id: "info",
      title: "Info",
      collapsible: true,
      params: [
        {
          id: "studyInfo",
          name: study.title,
          type: "readOnly",
          value: study.description,
        },
      ],
    },
  ] satisfies InputGroup[];
