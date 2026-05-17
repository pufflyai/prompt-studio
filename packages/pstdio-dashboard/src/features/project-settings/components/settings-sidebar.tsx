import { Sidebar, type TreeListNavigateEvent, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import {
  AlertTriangle,
  BookOpen,
  CircleDot,
  Cpu,
  FileText,
  GitFork,
  MessageSquareText,
  Orbit,
  Plus,
  Puzzle,
  Tag,
  Ticket,
} from "lucide-react";
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
  | "runtime"
  | "harnesses"
  | "ticket-statuses"
  | "attempt-statuses"
  | "tags"
  | "extensions"
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
  hasProject: boolean;
}

const resolveActiveNodeId = (activeSection: SettingsSection | null) => {
  if (!activeSection) return null;
  if (typeof activeSection === "string") return activeSection;
  if ("tag" in activeSection) return `tag:${activeSection.tag}`;
  if ("skill" in activeSection) return `skill:${activeSection.skill}`;
  return `template:${activeSection.template}`;
};

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { templates, skills, tags, activeSection, onSelectSection, onCreateTemplate, onCreateTag, hasProject } = props;
  const { t } = useTranslation(["projects", "settings"]);

  const buildSections = (): TreeListSection[] => {
    const runtimeNode: TreeListNode = {
      id: "runtime",
      label: t("settings:runtimeSettings.navLabel"),
      icon: <Cpu size={14} />,
      isNavigable: true,
      navigationIntent: { id: "select", payload: "runtime" },
    };
    const harnessNode: TreeListNode = {
      id: "harnesses",
      label: t("projects:projectSettings.harnesses"),
      icon: <Orbit size={14} />,
      isNavigable: true,
      navigationIntent: { id: "select", payload: "harnesses" },
    };
    const dangerNode: TreeListNode = {
      id: "danger-zone",
      label: t("projects:projectSettings.dangerZone"),
      icon: <AlertTriangle size={14} />,
      isNavigable: true,
      navigationIntent: { id: "select", payload: "danger-zone" },
    };

    const projectSettingsNodes: TreeListNode[] = [
      runtimeNode,
      harnessNode,
      {
        id: "extensions",
        label: t("projects:projectSettings.extensions"),
        icon: <Puzzle size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "extensions" },
      },
      {
        id: "repositories",
        label: t("projects:projectSettings.repositories"),
        icon: <GitFork size={14} />,
        isNavigable: true,
        navigationIntent: { id: "select", payload: "repositories" },
      },
    ];

    if (!hasProject) {
      return [{ id: "runtime-harnesses", nodes: [runtimeNode, harnessNode] }];
    }

    const tagChildNodes: TreeListNode[] = tags.map((tag) => ({
      id: `tag:${tag.id}`,
      label: tag.name,
      isNavigable: true,
      navigationIntent: { id: "select-tag", payload: tag.id },
    }));

    const skillChildNodes: TreeListNode[] = skills.map((skill) => ({
      id: `skill:${skill.name}`,
      label: skill.name,
      isNavigable: true,
      navigationIntent: { id: "select-skill", payload: skill.name },
    }));

    const generalNodes: TreeListNode[] = [
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
        label: t("projects:projectSettings.tags"),
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
      {
        id: "skills",
        label: t("projects:projectSettings.skills"),
        icon: <BookOpen size={14} />,
        isNavigable: false,
        children: skillChildNodes,
      },
    ];

    const buildTemplateNodes = (source: "project" | "extension", items: ProjectTemplateAsset[]) => {
      const grouped: Partial<Record<ProjectTemplateAssetType, ProjectTemplateAsset[]>> = {};
      for (const tpl of items) {
        const list = grouped[tpl.templateType] ?? [];
        list.push(tpl);
        grouped[tpl.templateType] = list;
      }

      return TEMPLATE_TYPE_ORDER.filter((type) => grouped[type]).map((type) => {
        const config = TEMPLATE_TYPE_CONFIG[type];
        const items = grouped[type]!;
        return {
          id: `${source}-template-group:${type}`,
          label: config.label,
          icon: config.icon,
          children: items.map((template) => ({
            id: `template:${template.name}`,
            label: template.name,
            isNavigable: true,
            navigationIntent: { id: "select-template", payload: template.name },
          })),
        } satisfies TreeListNode;
      });
    };

    const projectTemplates: ProjectTemplateAsset[] = [];
    const extensionTemplates: ProjectTemplateAsset[] = [];
    for (const tpl of templates) {
      const list = tpl.sourceKind === "extension" ? extensionTemplates : projectTemplates;
      list.push(tpl);
    }

    const templateSections: TreeListSection[] = [
      {
        id: "project-templates",
        label: t("projects:projectSettings.projectTemplates", { defaultValue: "Project templates" }),
        nodes: buildTemplateNodes("project", projectTemplates),
        actions: [
          {
            id: "create-template",
            label: t("projects:projectSettings.createTemplate"),
            icon: <Plus size={14} />,
            onAction: onCreateTemplate,
          },
        ],
      },
    ];

    if (extensionTemplates.length > 0) {
      templateSections.push({
        id: "extension-templates",
        label: t("projects:projectSettings.extensionTemplates", { defaultValue: "Extension templates" }),
        nodes: buildTemplateNodes("extension", extensionTemplates),
      });
    }

    return [
      { id: "project-settings", nodes: projectSettingsNodes },
      { id: "general", nodes: generalNodes },
      ...templateSections,
      { id: "danger", nodes: [dangerNode] },
    ];
  };

  const handleNavigate = (event: TreeListNavigateEvent) => {
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select") {
      onSelectSection(
        intent.payload as
          | "runtime"
          | "harnesses"
          | "ticket-statuses"
          | "attempt-statuses"
          | "repositories"
          | "extensions"
          | "tags"
          | "danger-zone",
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
    <Sidebar
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
