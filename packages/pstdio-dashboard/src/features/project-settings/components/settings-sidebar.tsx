import { type SidebarNavigateEvent, SidebarNext, type SidebarNode, type SidebarSection } from "@pstdio/ui";
import { AlertTriangle, FileText, MessageSquareText, Plus, Tag, TerminalSquare, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";

import type { ProjectTemplateAsset, ProjectTemplateAssetType } from "@/features/project/types";

const TEMPLATE_TYPE_CONFIG: Record<ProjectTemplateAssetType, { icon: React.ReactNode; label: string }> = {
  prompt: { icon: <MessageSquareText size={14} />, label: "Prompts" },
  ticket: { icon: <Ticket size={14} />, label: "Tickets" },
  document: { icon: <FileText size={14} />, label: "Documents" },
};

const TEMPLATE_TYPE_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];

export type SettingsSection = "tags" | "startup-script" | "danger-zone" | { template: string };

export const SETTINGS_SIDEBAR_STORAGE_KEY = "settings-sidebar";

interface SettingsSidebarProps {
  templates: ProjectTemplateAsset[];
  activeSection: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  onCreateTemplate: () => void;
}

const resolveActiveNodeId = (activeSection: SettingsSection | null) => {
  if (!activeSection) return null;
  if (activeSection === "tags") return "tags";
  if (activeSection === "startup-script") return "startup-script";
  if (activeSection === "danger-zone") return "danger-zone";
  return `template:${activeSection.template}`;
};

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { templates, activeSection, onSelectSection, onCreateTemplate } = props;
  const { t } = useTranslation("projects");

  const buildSections = (): SidebarSection[] => {
    const generalNodes: SidebarNode[] = [
      {
        id: "tags",
        label: t("projectSettings.tags"),
        icon: <Tag size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "tags" },
      },
      {
        id: "startup-script",
        label: t("projectSettings.startupScript", { defaultValue: "Startup script" }),
        icon: <TerminalSquare size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "startup-script" },
      },
    ];

    const grouped: Partial<Record<ProjectTemplateAssetType, ProjectTemplateAsset[]>> = {};
    for (const tpl of templates) {
      const list = grouped[tpl.templateType] ?? [];
      list.push(tpl);
      grouped[tpl.templateType] = list;
    }

    const templateNodes: SidebarNode[] = TEMPLATE_TYPE_ORDER.filter((type) => grouped[type]).map((type) => {
      const config = TEMPLATE_TYPE_CONFIG[type];
      const items = grouped[type]!;
      return {
        id: `template-group:${type}`,
        label: config.label,
        icon: config.icon,
        children: items.map((template) => ({
          id: `template:${template.name}`,
          label: template.name,
          isNavigable: true,
          navigationIntent: { id: "select-template", payload: template.name },
        })),
      };
    });

    const dangerNodes: SidebarNode[] = [
      {
        id: "danger-zone",
        label: t("projectSettings.dangerZone"),
        icon: <AlertTriangle size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "danger-zone" },
      },
    ];

    return [
      { id: "general", nodes: generalNodes },
      {
        id: "templates",
        label: t("projectSettings.templates"),
        nodes: templateNodes,
        actions: [
          {
            id: "create-template",
            label: t("projectSettings.createTemplate"),
            icon: <Plus size={14} />,
            onAction: onCreateTemplate,
          },
        ],
      },
      { id: "danger", nodes: dangerNodes },
    ];
  };

  const handleNavigate = (event: SidebarNavigateEvent) => {
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select") {
      onSelectSection(intent.payload as "tags" | "startup-script" | "danger-zone");
    }

    if (intent.id === "select-template") {
      onSelectSection({ template: intent.payload as string });
    }
  };

  return (
    <SidebarNext
      storageKey={SETTINGS_SIDEBAR_STORAGE_KEY}
      sections={buildSections()}
      activeNodeId={resolveActiveNodeId(activeSection)}
      header={<BackToDashboard />}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};
