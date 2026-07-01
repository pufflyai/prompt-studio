import { ParamEditor } from "@/components/param-editor";
import { GalleryCard } from "../gallery-frame";

// Showcases the rich authoring controls layered onto ParamEditor: sliders with
// units/markers, ranges, segmented/action modes, and specialized inputs.
export const ControlAuthoringCard = () => {
  return (
    <GalleryCard
      title="Control authoring"
      names={[
        "SliderControl",
        "RangeSliderControl",
        "SegmentedControl",
        "ActionControl",
        "AnchorGridControl",
        "VectorControl",
        "ColorOpacityControl",
      ]}
      gridColumn={{ base: "auto", xl: "span 2" }}
    >
      <ParamEditor
        fullWidth
        defaultValues={{
          anchor: "center",
          offset: { x: 0, y: 0 },
          opacity: 72,
          trim: [12, 84],
          quality: "balanced",
          tint: { hex: "#0C8CE9", opacity: 60 },
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
                type: "slider",
                defaultValue: 72,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
                markerCount: 5,
                variant: "discrete",
              },
              { id: "trim", name: "Trim", type: "range", defaultValue: [12, 84], min: 0, max: 100, unit: "%" },
            ],
          },
          {
            id: "mode",
            title: "Mode & color",
            description: "Segmented modes and color/opacity.",
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
              { id: "tint", name: "Tint", type: "colorOpacity", defaultValue: { hex: "#0C8CE9", opacity: 60 } },
            ],
          },
        ]}
        onChange={() => {}}
      />
    </GalleryCard>
  );
};
