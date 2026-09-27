import { getStudy, type StudyProps } from "@pstdio/motion-studies";
import type { InputGroup, Param } from "@pstdio/ui/param-editor";

const presets = [
  { id: "instant", name: "Instant" },
  { id: "subtle", name: "Subtle" },
  { id: "slower", name: "Slower" },
];
const variantGroup = (side: "left" | "right", title: string, settings: StudyProps) => {
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
  if (settings.study === "loaders" || settings.study === "chat-turn" || settings.study === "tools-queue") {
    params.push({
      id: `${side}.loader`,
      name: "Working treatment",
      type: "selection",
      defaultValue: variant.loader,
      options: [
        { id: "spinner", name: "Spinner" },
        { id: "pulse", name: "Pulse" },
        { id: "scan", name: "Scanning line" },
        { id: "aurora", name: "Aurora background" },
        { id: "contours", name: "Contour field" },
      ],
    });
  }
  if (settings.study === "streaming") {
    params.push({
      id: `${side}.streaming`,
      name: "Text arrival",
      description:
        "Chunk fade: 240 ms. Word reveal: 600 ms per received chunk. Instant and reduced motion remove both effects.",
      type: "selection",
      defaultValue: variant.streaming,
      options: [
        { id: "append", name: "Immediate" },
        { id: "fade", name: "Chunk fade" },
        { id: "words", name: "Word reveal" },
      ],
    });
  }
  return { id: side, title, params };
};
export const optionGroups = (settings: StudyProps) =>
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
    ...(settings.comparison ? [variantGroup("left", "Left preview", settings)] : []),
    variantGroup("right", settings.comparison ? "Right preview" : "Animation", settings),
    {
      id: "info",
      title: "Info",
      collapsible: true,
      params: [
        {
          id: "studyInfo",
          name: getStudy(settings.study).title,
          type: "readOnly",
          value: getStudy(settings.study).description,
        },
        { id: "export", name: "Configuration", type: "actions", options: [{ id: "copy", name: "Copy configuration" }] },
      ],
    },
  ] satisfies InputGroup[];
