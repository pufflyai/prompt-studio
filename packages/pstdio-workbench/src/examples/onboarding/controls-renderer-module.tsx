import type { InputGroup } from "@pstdio/ui";
import type { WorkbenchModuleContribution } from "../../core";

const CONTROLS_ID = "onboarding.controls.card-inspector";

const groups: InputGroup[] = [
  {
    id: "layout",
    title: "Layout",
    description: "Alignment and position.",
    collapsible: true,
    params: [
      {
        id: "align",
        name: "Align",
        type: "segmented",
        defaultValue: "center",
        options: [
          { id: "left", name: "Left" },
          { id: "center", name: "Center" },
          { id: "right", name: "Right" },
        ],
      },
      { id: "anchor", name: "Anchor", type: "anchorGrid", defaultValue: "center" },
      { id: "offset", name: "Offset", type: "vector", defaultValue: { x: 0, y: 0 }, min: -100, max: 100 },
    ],
  },
  {
    id: "style",
    title: "Style",
    description: "Corner radius and accent.",
    collapsible: true,
    params: [
      { id: "radius", name: "Corner radius", type: "range", defaultValue: [4, 16], min: 0, max: 32, unit: "px" },
      { id: "accent", name: "Accent", type: "color", defaultValue: "#0c8ce9" },
    ],
  },
];

const defaultValues: Record<string, unknown> = {
  align: "center",
  anchor: "center",
  offset: { x: 0, y: 0 },
  radius: [4, 16],
  accent: "#0c8ce9",
};

// A self-contained controls renderer backed by in-memory state. It mirrors the
// command-backed shape an extension declares (query / update / apply / reset)
// without a backend, so the ParamEditor inputs render through WorkbenchControlsView.
export const createControlsRendererModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.controls",
  activate(ctx) {
    const values: Record<string, unknown> = { ...defaultValues };

    ctx.renderers.registerControlsRenderer({
      id: CONTROLS_ID,
      title: "Card inspector",
      emptyTitle: "No controls",
      executeQuery: () => ({ groups, values: { ...values } }),
      updateValue: ({ controlId, value }) => {
        values[controlId] = value;
      },
      apply: ({ values: next }) => {
        Object.assign(values, next);
      },
      reset: () => {
        Object.assign(values, defaultValues);
        ctx.renderers.refreshControlsRenderer(CONTROLS_ID);
      },
    });

    ctx.layout.registerPanel({
      closable: false,
      id: CONTROLS_ID,
      title: "Card inspector",
      region: "main",
      rendererId: CONTROLS_ID,
      singleton: true,
    });

    ctx.layout.openPanel(CONTROLS_ID, { pinned: true });
  },
});
