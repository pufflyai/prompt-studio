import { type SidebarNavigateEvent, SidebarNext, type SidebarNode, type SidebarSection } from "@pstdio/ui";
import { AlertTriangle, CircleDot, FileText, GitFork, MessageSquareText, Plus, Tag, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import type { ProjectTemplateAsset, ProjectTemplateAssetType } from "@/features/project/types";
import type { TicketTag } from "@/features/ticket-list/types";
import type { ProjectSkill } from "../data/skills-api";

const TEMPLATE_TYPE_CONFIG: Record<ProjectTemplateAssetType, { icon: React.ReactNode; label: string }> = {
  prompt: { icon: <MessageSquareText size={14} />, label: "Prompts" },
  ticket: { icon: <Ticket size={14} />, label: "Tickets" },
  document: { icon: <FileText size={14} />, label: "Documents" },
};

const TEMPLATE_TYPE_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];

export type SettingsSection =
  | "ticket-statuses"
  | "attempt-statuses"
  | "tags"
  | "danger-zone"
  | "repositories"
  | { tag: string }
  | { template: string }
  | { skill: string };

export const SETTINGS_SIDEBAR_STORAGE_KEY = "settings-sidebar";

interface SettingsSidebarProps {
  templates: ProjectTemplateAsset[];
  skills: ProjectSkill[];
  tags: TicketTag[];
  activeSection: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  onCreateTemplate: () => void;
  onCreateTag: () => void;
}

const resolveActiveNodeId = (activeSection: SettingsSection | null) => {
  if (!activeSection) return null;
  if (activeSection === "ticket-statuses") return "ticket-statuses";
  if (activeSection === "attempt-statuses") return "attempt-statuses";
  if (activeSection === "tags") return "tags";
  if (activeSection === "repositories") return "repositories";
  if (activeSection === "danger-zone") return "danger-zone";
  if (typeof activeSection === "object" && "tag" in activeSection) return `tag:${activeSection.tag}`;

  if (typeof activeSection === "object" && "skill" in activeSection) return `skill:${activeSection.skill}`;
  return `template:${activeSection.template}`;
};

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { templates, skills, tags, activeSection, onSelectSection, onCreateTemplate, onCreateTag } = props;
  const { t } = useTranslation("projects");

  const buildSections = (): SidebarSection[] => {
    const tagChildNodes: SidebarNode[] = tags.map((tag) => ({
      id: `tag:${tag.id}`,
      label: tag.name,
      isNavigable: true,
      navigationIntent: { id: "select-tag", payload: tag.id },
    }));

    const generalNodes: SidebarNode[] = [
      {
        id: "ticket-statuses",
        label: "Statuses",
        icon: <Ticket size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "ticket-statuses" },
      },
      {
        id: "attempt-statuses",
        label: "Attempt Statuses",
        icon: <CircleDot size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "attempt-statuses" },
      },
      {
        id: "tags",
        label: t("projectSettings.tags"),
        icon: <Tag size={14} />,
        isNavigable: false,
        children: tagChildNodes,
        actions: [
          {
            id: "create-tag",
            label: "Create tag",
            icon: <Plus size={14} />,
            onAction: () => onCreateTag(),
          },
        ],
      },
    ];

    const repositoryNodes: SidebarNode[] = [
      {
        id: "repositories",
        label: t("projectSettings.repositories"),
        icon: <GitFork size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "repositories" },
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

    const skillNodes: SidebarNode[] = skills.map((skill) => ({
      id: `skill:${skill.name}`,
      label: skill.name,
      isNavigable: true,
      navigationIntent: { id: "select-skill", payload: skill.name },
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
        id: "skills",
        label: t("projectSettings.skills"),
        nodes: skillNodes,
      },
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
      { id: "repositories", nodes: repositoryNodes },
      { id: "danger", nodes: dangerNodes },
    ];
  };

  const handleNavigate = (event: SidebarNavigateEvent) => {
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select") {
      onSelectSection(
        intent.payload as "ticket-statuses" | "attempt-statuses" | "repositories" | "tags" | "danger-zone",
      );
    }

    if (intent.id === "select-template") {
      onSelectSection({ template: intent.payload as string });
    }

    if (intent.id === "select-tag") {
      onSelectSection({ tag: intent.payload as string });
    }

    if (intent.id === "select-skill") {
      onSelectSection({ skill: intent.payload as string });
    }

    if (intent.id === "create-tag") {
      onCreateTag();
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
