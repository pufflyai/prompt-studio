export const openablePanelsSource = `const panels = [
  { id: "output", title: "Output", resourceKinds: ["workspace"] },
  { id: "problems", title: "Problems", resourceKinds: ["workspace"] },
  { id: "notes", title: "Notes" }, // No resourceKinds means resource-agnostic.
];

for (const panel of panels) {
  ctx.layout.registerWidget({
    ...panel,
    area: "secondary",
    rendererId: "panel.renderer",
    openable: true,
    singleton: false,
    reuse: "none",
  });
}

// Openable widgets appear in the panel slot's plus menu. Existing tabs can be
// reordered from their context menu without changing their resource binding.
ctx.layout.moveWidget("output", { areaId: "secondary", index: 1 });`;
