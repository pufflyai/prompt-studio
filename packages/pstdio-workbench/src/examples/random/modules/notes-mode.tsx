import type { Disposable, TreeNode, WorkbenchModeActivationContext, WorkbenchModuleContext } from "../../../core";
import type { WorkbenchPanelRenderInput } from "../../../react";
import { NotesEditor, NotesHelper, NotesRelated, NotesStatus, NotesTopBar } from "../components/notes";
import {
  itemResource,
  notesWidgetIds,
  railWidgetId,
  randomResourceKind,
  randomWorkbenchModes,
} from "../mock-data/data";

const notesMode = randomWorkbenchModes.notes;

interface NotesWidgetSetup {
  id: string;
  title: string;
  region: "nav" | "main" | "main-right-menu" | "status" | "side";
  render: (input: WorkbenchPanelRenderInput) => React.ReactNode;
}

const notesWidgets: NotesWidgetSetup[] = [
  { id: notesWidgetIds.top, title: "Notes header", region: "nav", render: (input) => <NotesTopBar input={input} /> },
  { id: notesWidgetIds.editor, title: "Note editor", region: "main", render: (input) => <NotesEditor input={input} /> },
  { id: notesWidgetIds.related, title: "Linked notes", region: "main-right-menu", render: () => <NotesRelated /> },
  { id: notesWidgetIds.status, title: "Sync status", region: "status", render: () => <NotesStatus /> },
  { id: notesWidgetIds.helper, title: "Note helper", region: "side", render: () => <NotesHelper /> },
];

const buildNotesTreeSections = () =>
  notesMode.folders.map((folder) => ({
    id: folder.id,
    label: folder.label,
    nodes: folder.itemIds.flatMap((itemId): TreeNode[] => {
      const item = notesMode.items.find((candidate) => candidate.id === itemId);
      if (!item) return [];
      const resource = itemResource(notesMode.id, item);
      return [
        {
          id: resource.uri,
          label: item.title,
          icon: "FileText",
          resource,
        },
      ];
    }),
  }));

const setupNotesMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [];

  for (const widget of notesWidgets) {
    disposables.push(
      ctx.renderers.registerRenderer({ id: widget.id, render: widget.render }),
      ctx.layout.registerPanel({
        id: widget.id,
        title: widget.title,
        region: widget.region,
        singleton: true,
        rendererId: widget.id,
      }),
    );
  }

  disposables.push(
    ctx.renderers.registerTreeRenderer({
      id: "notes.navigation",
      title: notesMode.label,
      getBody: () => buildNotesTreeSections(),
      getChildren: () => [],
    }),
    ctx.layout.registerPanel({
      id: "notes.navigation",
      title: notesMode.label,
      region: "main-left-menu",
      rendererId: "notes.navigation",
    }),
    ctx.resources.registerPresenter({
      id: "notes.presenter",
      canOpen: (resource) => resource.kind === randomResourceKind && resource.metadata?.modeId === notesMode.id,
      open: (resource, input) =>
        ctx.layout.openPanel(notesWidgetIds.editor, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
          resource,
          title: resource.label,
        }),
    }),
  );

  ctx.layout.openPanel(railWidgetId, { pinned: true });
  ctx.layout.openPanel("notes.navigation");

  const defaultItem = notesMode.items.find((item) => item.id === notesMode.defaultItemId) ?? notesMode.items[0];
  ctx.layout.openPanel(notesWidgetIds.editor, {
    resource: itemResource(notesMode.id, defaultItem),
    title: defaultItem.title,
  });
  for (const widget of notesWidgets) {
    if (widget.id === notesWidgetIds.editor) continue;
    ctx.layout.openPanel(widget.id, { pinned: true });
  }

  return disposables;
};

export const registerNotesMode = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: notesMode.id,
    label: notesMode.label,
    activate: setupNotesMode,
  });
};
