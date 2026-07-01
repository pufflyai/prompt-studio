import { ParamEditor } from "@/components/param-editor";
import { GalleryCard } from "../gallery-frame";

// Showcases the rich authoring inputs layered onto ParamEditor: numeric sliders,
// ranges, segmented/action modes, and specialized inputs.
export const InputAuthoringCard = () => {
  return (
    <GalleryCard
      title="Control authoring"
      names={[
        "NumberInput",
        "RangeInput",
        "SegmentedInput",
        "ActionInput",
        "AnchorGridInput",
        "VectorInput",
        "ColorInput",
        "ResourceInput",
      ]}
      gridColumn={{ base: "auto", xl: "span 2" }}
    >
      <ParamEditor
        fullWidth
        onOpenResource={() => {}}
        defaultValues={{
          anchor: "center",
          offset: { x: 0, y: 0 },
          opacity: 72,
          trim: [12, 84],
          quality: "balanced",
          tint: "#0C8CE9",
          status: "in-progress",
          labels: ["feature"],
        }}
        groups={[
          {
            id: "layout",
            title: "Layout",
            description: "Alignment and offset.",
            collapsible: true,
            params: [
              { id: "anchor", name: "Anchor", type: "anchorGrid", defaultValue: "center" },
              {
                id: "offset",
                name: "Offset",
                type: "vector",
                defaultValue: { x: 0, y: 0 },
                min: -100,
                max: 100,
              },
            ],
          },
          {
            id: "numeric",
            title: "Numeric",
            description: "Sliders and ranges with units.",
            collapsible: true,
            params: [
              {
                id: "opacity",
                name: "Opacity",
                type: "number",
                defaultValue: 72,
                min: 0,
                max: 100,
                step: 5,
              },
              { id: "trim", name: "Trim", type: "range", defaultValue: [12, 84], min: 0, max: 100, unit: "%" },
            ],
          },
          {
            id: "mode",
            title: "Mode & color",
            description: "Segmented modes and color.",
            collapsible: true,
            params: [
              {
                id: "quality",
                name: "Quality",
                type: "segmented",
                defaultValue: "balanced",
                options: [
                  { id: "draft", name: "Draft" },
                  { id: "balanced", name: "Balanced" },
                  { id: "detailed", name: "Detailed" },
                ],
              },
              { id: "tint", name: "Tint", type: "color", defaultValue: "#0C8CE9" },
            ],
          },
          {
            id: "references",
            title: "References",
            description: "Resources rendered as tags.",
            collapsible: true,
            params: [
              {
                id: "status",
                name: "Status",
                type: "resource",
                editable: true,
                defaultValue: "in-progress",
                options: [
                  { id: "todo", name: "To do", icon: "circle", color: "gray" },
                  { id: "in-progress", name: "In progress", icon: "clock", color: "blue" },
                  { id: "done", name: "Done", icon: "check-circle", color: "green" },
                ],
              },
              {
                id: "labels",
                name: "Labels",
                type: "resource",
                editable: true,
                multiSelect: true,
                placeholder: "Add label",
                defaultValue: ["feature"],
                options: [
                  { id: "bug", name: "Bug", icon: "bug", color: "red" },
                  { id: "feature", name: "Feature", icon: "sparkles", color: "purple" },
                ],
              },
            ],
          },
        ]}
        onChange={() => {}}
      />
    </GalleryCard>
  );
};
