export const widgetVariantsSource = `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

const LOCATION_KIND = "docs.widget-variants";
const NOTE_KIND = "docs.note";
const LOCATION_PANEL_ID = "docs.widget-variants.location";
const SINGLETON_SUB_PANEL_ID = "docs.widget-variants.singleton";
const NOTE_SUB_PANEL_ID = "docs.widget-variants.note";
const SCRATCH_SUB_PANEL_ID = "docs.widget-variants.scratch";
const RENDERER_ID = "docs.widget.renderer";

const locationResource = {
  kind: LOCATION_KIND,
  uri: \`\${LOCATION_KIND}:overview\`,
  id: "overview",
  label: "Widget variants",
};

const noteResource = (id: "alpha" | "beta") => ({
  kind: NOTE_KIND,
  uri: \`\${NOTE_KIND}:\${id}\`,
  id,
  label: id === "alpha" ? "Alpha note" : "Beta note",
});

export const createWidgetVariantsModule = (): WorkbenchModuleContribution => ({
  id: "docs.widget-variants",
  activate(ctx) {
    ctx.layout.registerLocation({
      id: LOCATION_PANEL_ID,
      title: "Widget variants",
      region: "main",
      resourceKinds: [LOCATION_KIND],
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerSubPanel({
      id: SINGLETON_SUB_PANEL_ID,
      title: "Closable singleton",
      region: "main",
      eligibleLocations: { resourceKinds: [LOCATION_KIND] },
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerSubPanel({
      id: NOTE_SUB_PANEL_ID,
      title: "Resource Sub Panel",
      region: "main",
      singleton: false,
      resourceKinds: [NOTE_KIND],
      eligibleLocations: { resourceKinds: [LOCATION_KIND] },
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerSubPanel({
      id: SCRATCH_SUB_PANEL_ID,
      title: "Scratch",
      region: "main",
      singleton: false,
      reuse: "none",
      eligibleLocations: { resourceKinds: [LOCATION_KIND] },
      rendererId: RENDERER_ID,
    });

    ctx.renderers.registerRenderer({
      id: RENDERER_ID,
      render: ({ placement, widget }) => (
        <article>
          <h2>{placement.title}</h2>
          <dl>
            <dt>role</dt>
            <dd>{"role" in widget ? widget.role : "placeholder"}</dd>
            <dt>closable</dt>
            <dd>{String(placement.closable === true)}</dd>
            <dt>reuse</dt>
            <dd>{"reuse" in widget ? widget.reuse : "resource"}</dd>
          </dl>
        </article>
      ),
    });

    ctx.layout.openWidget(LOCATION_PANEL_ID, { resource: locationResource });
    ctx.layout.openWidget(SINGLETON_SUB_PANEL_ID);
    ctx.layout.openWidget(NOTE_SUB_PANEL_ID, { resource: noteResource("alpha") });
    ctx.layout.openWidget(NOTE_SUB_PANEL_ID, { resource: noteResource("beta") });
    ctx.layout.openWidget(SCRATCH_SUB_PANEL_ID, { title: "Scratch 1" });
  },
});`;
