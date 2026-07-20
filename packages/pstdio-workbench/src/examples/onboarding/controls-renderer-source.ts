export const controlsRendererSource = `// A controls renderer resolves serializable ParamEditor declarations + values and
// renders them through the workbench WorkbenchControlsView. Live edits commit through
// updateValue; the sticky footer's Apply/Reset use apply/reset. Omitting both
// updateValue and apply (or returning readOnly: true) makes the panel read-only.
ctx.renderers.registerControlsRenderer({
  id: "card-inspector",
  title: "Card inspector",
  executeQuery: () => ({ groups, values }),
  updateValue: ({ controlId, value }) => {
    values[controlId] = value;
  },
  reset: () => {
    Object.assign(values, defaultValues);
    ctx.renderers.refreshControlsRenderer("card-inspector");
  },
});

// A controls renderer auto-registers a widget renderer with the same id; place it
// through the layout. Extensions declare this as a \\\`controls\\\` contribution and the
// dashboard bridges the query/update/apply/reset command ids for you.
ctx.layout.registerWidget({
  id: "card-inspector",
  title: "Card inspector",
  region: "main-right-menu",
  regionSize: { defaultPx: 320, minPx: 260, maxPx: 480 },
  rendererId: "card-inspector",
});
`;
