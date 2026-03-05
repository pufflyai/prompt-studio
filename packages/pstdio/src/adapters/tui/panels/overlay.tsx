import type { ReactNode } from "react";

import type { Mode } from "../app";
import type { AgentRow } from "../hooks/use-agents";
import type { SettingsSection, SettingsStatus, SettingsTag } from "../hooks/use-settings";
import { AgentManager } from "./agent-manager";
import { ConfirmDialog } from "./confirm-dialog";
import { HelpModal } from "./help-modal";
import { MarkdownView } from "./markdown-view";
import { ProjectPicker } from "./project-picker";
import { Settings } from "./settings";
import { StatusPicker } from "./status-picker";
import { TicketCreate } from "./ticket-create";

interface OverlayProps {
  mode: Mode;
  columns: number;
  viewportHeight: number;
  viewContent: { title: string; content: string };
  projects: { id: string; name: string }[];
  currentProjectId: string | null;
  pickerIndex: number;
  agents: AgentRow[];
  agentIndex: number;
  statuses: { id: string; name: string; color: string; sort_order: number }[];
  archiveTarget: { id: string; title: string | null } | null;
  settingsSection: SettingsSection;
  settingsStatuses: SettingsStatus[];
  settingsTags: SettingsTag[];
  settingsIndex: number;
  settingsColorPicker: boolean;
  settingsColorIndex: number;
  settingsCreateStep: "idle" | "name" | "color";
}

export function renderOverlay({
  mode,
  columns,
  viewportHeight,
  viewContent,
  projects,
  currentProjectId,
  pickerIndex,
  agents,
  agentIndex,
  statuses,
  archiveTarget,
  settingsSection,
  settingsStatuses,
  settingsTags,
  settingsIndex,
  settingsColorPicker,
  settingsColorIndex,
  settingsCreateStep,
}: OverlayProps): ReactNode | null {
  if (mode.overlay === "help") {
    return <HelpModal tab={mode.tab} width={columns} viewportHeight={viewportHeight} />;
  }
  if (mode.overlay === "view") {
    return (
      <MarkdownView
        title={viewContent.title}
        content={viewContent.content}
        width={columns}
        viewportHeight={viewportHeight}
      />
    );
  }
  if (mode.overlay === "projects") {
    return (
      <ProjectPicker
        projects={projects}
        currentProjectId={currentProjectId}
        selectedIndex={pickerIndex}
        width={columns}
        viewportHeight={viewportHeight}
      />
    );
  }
  if (mode.overlay === "agents") {
    return <AgentManager agents={agents} selectedIndex={agentIndex} width={columns} viewportHeight={viewportHeight} />;
  }
  if (mode.overlay === "status-picker") {
    return (
      <StatusPicker statuses={statuses} selectedIndex={pickerIndex} width={columns} viewportHeight={viewportHeight} />
    );
  }
  if (mode.overlay === "ticket-create") {
    return <TicketCreate width={columns} viewportHeight={viewportHeight} />;
  }
  if (mode.overlay === "confirm-archive") {
    const title = archiveTarget?.title ?? "this ticket";
    return <ConfirmDialog message={`Archive "${title}"?`} width={columns} viewportHeight={viewportHeight} />;
  }
  if (mode.overlay === "settings") {
    return (
      <Settings
        section={settingsSection}
        statuses={settingsStatuses}
        tags={settingsTags}
        selectedIndex={settingsIndex}
        width={columns}
        viewportHeight={viewportHeight}
        colorPickerActive={settingsColorPicker || settingsCreateStep === "color"}
        colorPickerIndex={settingsColorIndex}
        createStep={settingsCreateStep}
      />
    );
  }
  return null;
}
