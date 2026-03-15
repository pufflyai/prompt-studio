import type { SidebarNavigateEvent, SidebarNode, SidebarSection } from "@pstdio/ui";
import { SidebarNext } from "@pstdio/ui";
import { AlertTriangle, FileText, Plus, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import type { ProjectTemplateAsset } from "@/features/project/types";

export type SettingsSection = "tags" | "danger-zone" | { template: string };

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
    ];

    const templateNodes: SidebarNode[] = templates.map((template) => ({
      id: `template:${template.name}`,
      label: template.name,
      description: template.isDefault ? "default" : undefined,
      icon: <FileText size={14} />,
      isNavigable: true,
      navigationIntent: { id: "select-template", payload: template.name },
    }));

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
      onSelectSection(intent.payload as "tags" | "danger-zone");
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
