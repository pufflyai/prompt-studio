import { useState } from "react";
import { createShellCore, type ShellArea, type ShellCore } from "../core";
import { ShellWorkbench } from "../react";
import {
  defaultShellModeId,
  itemResource,
  notesModeContextKey,
  notesResourceKind,
  notesWidgetIds,
  shellModeOrder,
  shellModes,
} from "./notes-shell-example-data";
import { registerNotesRenderers } from "./notes-shell-example-views";

const registerWidget = (shell: ShellCore, id: string, title: string, area: ShellArea) => {
  shell.layout.registerWidget({ id, title, area, singleton: true, renderer: "react", rendererId: id });
};

const registerNotesWidgets = (shell: ShellCore) => {
  registerWidget(shell, notesWidgetIds.top, "Top bar", "top");
  registerWidget(shell, notesWidgetIds.rail, "Mode rail", "activityBar");
  registerWidget(shell, notesWidgetIds.header, "Item header", "main-header");
  registerWidget(shell, notesWidgetIds.tree, "Item tree", "main-left");
  registerWidget(shell, notesWidgetIds.editor, "Item editor", "main");
  registerWidget(shell, notesWidgetIds.details, "Item details", "main-right");
  registerWidget(shell, notesWidgetIds.status, "Status", "status");
  registerWidget(shell, notesWidgetIds.helper, "Helper", "floating");
};

const registerNotesShell = (shell: ShellCore) => {
  shell.resources.registerKind({ kind: notesResourceKind, label: "Item", icon: "FileText" });
  shell.resources.registerOpener({
    id: "notes.opener",
    priority: 100,
    canOpen: (resource) => resource.kind === notesResourceKind,
    open: (resource) => shell.layout.openWidget(notesWidgetIds.editor, { resource, title: resource.label }),
  });
};

const registerModeCommands = (shell: ShellCore) => {
  for (const modeId of shellModeOrder) {
    const mode = shellModes[modeId];
    for (const item of mode.items) {
      shell.commands.registerCommand(
        { id: `notes.open.${mode.id}.${item.id}`, label: `${mode.label}: Open ${item.title}` },
        {
          execute: async () => {
            shell.context.set(notesModeContextKey, mode.id);
            await shell.resources.openResource(itemResource(mode.id, item));
          },
        },
      );
    }
  }
};

const openInitialLayout = (shell: ShellCore) => {
  shell.context.set(notesModeContextKey, defaultShellModeId);

  shell.layout.openWidget(notesWidgetIds.top, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.rail, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.header, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.tree, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.details, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.status, { pinned: true, closable: false });
  shell.layout.openWidget(notesWidgetIds.helper, { pinned: true, closable: false });

  const defaultMode = shellModes[defaultShellModeId];
  const defaultItem = defaultMode.items.find((item) => item.id === defaultMode.defaultItemId) ?? defaultMode.items[0];
  shell.layout.openWidget(notesWidgetIds.editor, {
    resource: itemResource(defaultMode.id, defaultItem),
    title: defaultItem.title,
    closable: false,
  });
};

interface ExampleInput {
  openCommandPalette: () => void;
}

const createNotesShellExample = (input: ExampleInput) => {
  const shell = createShellCore();

  registerNotesShell(shell);
  registerNotesWidgets(shell);
  registerModeCommands(shell);
  registerNotesRenderers(shell, { openCommandPalette: input.openCommandPalette });
  openInitialLayout(shell);

  return { shell };
};

export const NotesShellExample = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [example] = useState(() => createNotesShellExample({ openCommandPalette: () => setPaletteOpen(true) }));

  return (
    <ShellWorkbench
      shell={example.shell}
      commandPaletteOpen={paletteOpen}
      onCommandPaletteOpenChange={setPaletteOpen}
    />
  );
};
