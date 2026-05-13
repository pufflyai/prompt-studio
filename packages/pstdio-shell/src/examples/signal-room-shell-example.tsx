import { useState } from "react";
import { createShellCore, type ShellArea, type ShellCore } from "../core";
import { ShellWorkbench } from "../react";
import {
  signalRoomLogRows,
  signalRoomResourceKind,
  signalRoomResources,
  signalRoomWidgetIds,
} from "./signal-room-shell-example-data";
import { createSignalRoomRenderers } from "./signal-room-shell-example-views";

const registerWidget = (shell: ShellCore, id: string, title: string, area: ShellArea) => {
  shell.layout.registerWidget({ id, title, area, singleton: true, renderer: "react", rendererId: id });
};

const registerSignalRoomShell = (shell: ShellCore) => {
  shell.resources.registerKind({ kind: signalRoomResourceKind, label: "Signal room", icon: "Radar" });
  shell.resources.registerOpener({
    id: "signal-room.opener",
    priority: 100,
    canOpen: (resource) => resource.kind === signalRoomResourceKind,
    open: (resource) => {
      const widgetId = resource.metadata?.widgetId;
      if (typeof widgetId !== "string") return undefined;
      return shell.layout.openWidget(widgetId, { resource, title: resource.label });
    },
  });
  shell.activity.registerKind({ kind: "signal-room.event", title: "Signal room event", icon: "Activity" });
  shell.commands.registerCommand(
    { id: "signal-room.acknowledge", label: "Acknowledge signal", icon: "CheckCheck" },
    {
      execute: () =>
        shell.activity.emit({
          id: `signal-room.acknowledged.${Date.now()}`,
          kind: "signal-room.event",
          title: "Signals acknowledged",
          severity: "success",
          createdAt: new Date().toISOString(),
        }),
    },
  );
};

const registerSignalRoomWidgets = (shell: ShellCore) => {
  registerWidget(shell, signalRoomWidgetIds.top, "Signal room top bar", "top");
  registerWidget(shell, signalRoomWidgetIds.rail, "Signal rail", "activityBar");
  registerWidget(shell, signalRoomWidgetIds.header, "Signal header", "main-header");
  registerWidget(shell, signalRoomWidgetIds.surface, "Signal surface", "main");
  registerWidget(shell, signalRoomWidgetIds.queue, "Escalation queue", "main");
  registerWidget(shell, signalRoomWidgetIds.context, "Runbook context", "main-right");
  registerWidget(shell, signalRoomWidgetIds.log, "Signal log", "main-bottom");
  registerWidget(shell, signalRoomWidgetIds.status, "Signal status", "status");
  registerWidget(shell, signalRoomWidgetIds.assistant, "Release copilot", "floating");
};

const openInitialSignalRoomLayout = (shell: ShellCore) => {
  shell.layout.openWidget(signalRoomWidgetIds.top, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.rail, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.header, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.surface, { resource: signalRoomResources.surface, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.context, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.log, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.status, { pinned: true, closable: false });
  shell.layout.openWidget(signalRoomWidgetIds.assistant, { pinned: true, closable: false });
};

const seedSignalRoomActivity = (shell: ShellCore) => {
  for (const row of signalRoomLogRows) {
    shell.activity.emit({
      id: `signal-room.${row.time}.${row.label}`,
      kind: "signal-room.event",
      title: row.label,
      severity: row.severity === "warning" ? "warning" : "info",
      createdAt: `2026-05-13T${row.time}:00.000Z`,
    });
  }
};

const createSignalRoomShellExample = () => {
  const shell = createShellCore();

  registerSignalRoomShell(shell);
  registerSignalRoomWidgets(shell);
  openInitialSignalRoomLayout(shell);
  seedSignalRoomActivity(shell);

  return { shell, renderers: createSignalRoomRenderers() };
};

export const SignalRoomShellExample = () => {
  const [example] = useState(createSignalRoomShellExample);

  return <ShellWorkbench shell={example.shell} renderers={example.renderers} />;
};
