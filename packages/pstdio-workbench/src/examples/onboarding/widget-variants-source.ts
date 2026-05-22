export const widgetVariantsSource = `import type { WorkbenchModuleContribution } from "pstdio-workbench/core";

const NOTE_KIND = "docs.note";
const SINGLETON_WIDGET_ID = "docs.singleton";
const CLOSABLE_SINGLETON_WIDGET_ID = "docs.closable-singleton";
const NOTE_WIDGET_ID = "docs.note";
const SCRATCH_WIDGET_ID = "docs.scratch";
const RENDERER_ID = "docs.widget.renderer";

const noteResource = (id: "alpha" | "beta") => ({
  kind: NOTE_KIND,
  uri: \`\${NOTE_KIND}:\${id}\`,
  id,
  label: id === "alpha" ? "Alpha note" : "Beta note",
});

export const createWidgetVariantsModule = (): WorkbenchModuleContribution => ({
  id: "docs.widget-variants",
  activate(ctx) {
    ctx.layout.registerWidget({
      id: SINGLETON_WIDGET_ID,
      title: "Default singleton",
      area: "main",
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: CLOSABLE_SINGLETON_WIDGET_ID,
      title: "Closable singleton",
      area: "main",
      closable: true,
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: NOTE_WIDGET_ID,
      title: "Note",
      area: "main",
      singleton: false,
      resourceKinds: [NOTE_KIND],
      rendererId: RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: SCRATCH_WIDGET_ID,
      title: "Scratch",
      area: "main",
      singleton: false,
      reuse: "none",
      rendererId: RENDERER_ID,
    });

    ctx.renderers.registerRenderer({
      id: RENDERER_ID,
      render: ({ placement, widget }) => (
        <article>
          <h2>{placement.title}</h2>
          <dl>
            <dt>singleton</dt>
            <dd>{"singleton" in widget ? String(widget.singleton) : "false"}</dd>
            <dt>closable</dt>
            <dd>{String(placement.closable === true)}</dd>
            <dt>reuse</dt>
            <dd>{"reuse" in widget ? widget.reuse : "resource"}</dd>
          </dl>
        </article>
      ),
    });

    ctx.layout.openWidget(SINGLETON_WIDGET_ID);
    ctx.layout.openWidget(CLOSABLE_SINGLETON_WIDGET_ID);
    ctx.layout.openWidget(NOTE_WIDGET_ID, { resource: noteResource("alpha") });
    ctx.layout.openWidget(NOTE_WIDGET_ID, { resource: noteResource("beta") });
    ctx.layout.openWidget(SCRATCH_WIDGET_ID, { title: "Scratch 1" });
  },
});`;
