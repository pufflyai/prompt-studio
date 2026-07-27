export const widgetVariantsSource = `import type { WorkbenchModuleContribution } from "@pstdio/workbench";

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
    ctx.resources.registerKind({ kind: LOCATION_KIND, label: "Widget variants" });
    ctx.resources.registerPresenter({
      id: "docs.widget-variants.presenter",
      canOpen: (resource) => resource.kind === LOCATION_KIND,
      open: (resource) => ctx.layout.openPanel(LOCATION_PANEL_ID, { resource }),
    });

    ctx.layout.registerPanel({
      closable: false,
      id: LOCATION_PANEL_ID,
      title: "Widget variants",
      region: "main",
      resourceKinds: [LOCATION_KIND],
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerPanel({
      closable: true,
      id: SINGLETON_SUB_PANEL_ID,
      title: "Closable singleton",
      region: "main",
      eligibleLocations: { resourceKinds: [LOCATION_KIND] },
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerPanel({
      closable: true,
      id: NOTE_SUB_PANEL_ID,
      title: "Resource Sub Panel",
      region: "main",
      singleton: false,
      resourceKinds: [NOTE_KIND],
      eligibleLocations: { resourceKinds: [LOCATION_KIND] },
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerPanel({
      closable: true,
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
      render: ({ instance, panel }) => (
        <article>
          <h2>{instance.title}</h2>
          <dl>
            <dt>closable</dt>
            <dd>{String(instance.closable)}</dd>
            <dt>reuse</dt>
            <dd>{panel.reuse ?? "resource"}</dd>
          </dl>
        </article>
      ),
    });

    void ctx.resources.openResource(locationResource).then(() => {
      ctx.layout.openPanel(SINGLETON_SUB_PANEL_ID);
      ctx.layout.openPanel(NOTE_SUB_PANEL_ID, { resource: noteResource("alpha") });
      ctx.layout.openPanel(NOTE_SUB_PANEL_ID, { resource: noteResource("beta") });
      ctx.layout.openPanel(SCRATCH_SUB_PANEL_ID, { title: "Scratch 1" });
    });
  },
});`;
