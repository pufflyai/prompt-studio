import type {
  Disposable,
  TreeNode,
  WorkbenchModeActivationContext,
  WorkbenchModuleContributionContext,
} from "../../../core";
import type { WorkbenchWidgetRenderInput } from "../../../react";
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
  area: "top" | "main" | "main-right" | "status" | "floating";
  render: (input: WorkbenchWidgetRenderInput) => React.ReactNode;
}

const notesWidgets: NotesWidgetSetup[] = [
  { id: notesWidgetIds.top, title: "Notes header", area: "top", render: (input) => <NotesTopBar input={input} /> },
  { id: notesWidgetIds.editor, title: "Note editor", area: "main", render: (input) => <NotesEditor input={input} /> },
  { id: notesWidgetIds.related, title: "Linked notes", area: "main-right", render: () => <NotesRelated /> },
  { id: notesWidgetIds.status, title: "Sync status", area: "status", render: () => <NotesStatus /> },
  { id: notesWidgetIds.helper, title: "Note helper", area: "floating", render: () => <NotesHelper /> },
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
      ctx.layout.registerWidget({
        id: widget.id,
        title: widget.title,
        area: widget.area,
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
    ctx.layout.registerWidget({
      id: "notes.navigation",
      title: notesMode.label,
      area: "main-left",
      rendererId: "notes.navigation",
    }),
    ctx.resources.registerOpener({
      id: "notes.opener",
      canOpen: (resource) => resource.kind === randomResourceKind && resource.metadata?.modeId === notesMode.id,
      open: (resource, input) =>
        ctx.layout.openWidget(notesWidgetIds.editor, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  );

  ctx.layout.openWidget(railWidgetId, { pinned: true });
  ctx.layout.openWidget("notes.navigation");

  const defaultItem = notesMode.items.find((item) => item.id === notesMode.defaultItemId) ?? notesMode.items[0];
  ctx.layout.openWidget(notesWidgetIds.editor, {
    resource: itemResource(notesMode.id, defaultItem),
    title: defaultItem.title,
  });
  for (const widget of notesWidgets) {
    if (widget.id === notesWidgetIds.editor) continue;
    ctx.layout.openWidget(widget.id, { pinned: true });
  }

  return disposables;
};

export const registerNotesMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: notesMode.id,
    label: notesMode.label,
    activate: setupNotesMode,
  });
};
