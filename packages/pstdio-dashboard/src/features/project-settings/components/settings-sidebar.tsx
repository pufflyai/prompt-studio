import type { SidebarActionMenuItem } from "@pstdio/ui";
import { type SidebarNavigateEvent, SidebarNext, type SidebarNode, type SidebarSection } from "@pstdio/ui";
import { AlertTriangle, FileText, GitFork, MessageSquareText, Plus, Tag, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import type { ProjectTemplateAsset, ProjectTemplateAssetType } from "@/features/project/types";
import type { TicketTag } from "@/features/ticket-list/types";
import type { HookEntry } from "../data/hooks-api";
import type { ProjectSkill } from "../data/skills-api";

const TEMPLATE_TYPE_CONFIG: Record<ProjectTemplateAssetType, { icon: React.ReactNode; label: string }> = {
  prompt: { icon: <MessageSquareText size={14} />, label: "Prompts" },
  ticket: { icon: <Ticket size={14} />, label: "Tickets" },
  document: { icon: <FileText size={14} />, label: "Documents" },
};

const TEMPLATE_TYPE_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];

export type SettingsSection =
  | "ticket-statuses"
  | "tags"
  | "danger-zone"
  | "repositories"
  | "danger-zone"
  | { tag: string }
  | { template: string }
  | { hook: string }
  | { skill: string };

export const SETTINGS_SIDEBAR_STORAGE_KEY = "settings-sidebar";

const HOOK_DESCRIPTIONS: Record<string, string> = {
  "pre-create": "Before worktree is created",
  "post-create": "After worktree is created",
  "pre-commit": "Before staging and committing",
  "post-commit": "After a commit is created",
  "pre-rebase": "Before rebasing onto target",
  "post-rebase": "After successful rebase",
  "pre-merge": "Before squash-merging",
  "post-merge": "After successful merge",
  "pre-remove": "Before worktree deletion",
  "post-remove": "After worktree is removed",
  "on-conflict": "When merge/rebase hits conflicts",
};

interface SettingsSidebarProps {
  templates: ProjectTemplateAsset[];
  hooks: HookEntry[];
  skills: ProjectSkill[];
  tags: TicketTag[];
  activeSection: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  onCreateTemplate: () => void;
  onCreateTag: () => void;
  onAddHook: (hookName: string) => void;
}

const resolveActiveNodeId = (activeSection: SettingsSection | null) => {
  if (!activeSection) return null;
  if (activeSection === "ticket-statuses") return "ticket-statuses";
  if (activeSection === "tags") return "tags";
  if (activeSection === "repositories") return "repositories";
  if (activeSection === "danger-zone") return "danger-zone";
  if (typeof activeSection === "object" && "tag" in activeSection) return `tag:${activeSection.tag}`;
  if (typeof activeSection === "object" && "hook" in activeSection) return `hook:${activeSection.hook}`;
  if (typeof activeSection === "object" && "skill" in activeSection) return `skill:${activeSection.skill}`;
  return `template:${activeSection.template}`;
};

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { templates, hooks, skills, tags, activeSection, onSelectSection, onCreateTemplate, onCreateTag, onAddHook } =
    props;
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

    const installedHooks = hooks.filter((h) => h.content !== null);
    const uninstalledHooks = hooks.filter((h) => h.content === null);

    const hookNodes: SidebarNode[] = installedHooks.map((hook) => ({
      id: `hook:${hook.name}`,
      label: hook.name,
      isNavigable: true,
      navigationIntent: { id: "select-hook", payload: hook.name },
    }));

    const skillNodes: SidebarNode[] = skills.map((skill) => ({
      id: `skill:${skill.name}`,
      label: skill.name,
      isNavigable: true,
      navigationIntent: { id: "select-skill", payload: skill.name },
    }));

    const addHookMenuItems: SidebarActionMenuItem[] = uninstalledHooks.map((hook) => ({
      id: hook.name,
      label: hook.name,
      description: HOOK_DESCRIPTIONS[hook.name],
      onAction: () => onAddHook(hook.name),
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
        id: "hooks",
        label: "Hooks",
        nodes: hookNodes,
        actions:
          addHookMenuItems.length > 0
            ? [
                {
                  id: "add-hook",
                  label: "Add hook",
                  icon: <Plus size={14} />,
                  menuItems: addHookMenuItems,
                },
              ]
            : [],
      },
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
      onSelectSection(intent.payload as "ticket-statuses" | "repositories" | "tags" | "danger-zone");
    }

    if (intent.id === "select-template") {
      onSelectSection({ template: intent.payload as string });
    }

    if (intent.id === "select-hook") {
      onSelectSection({ hook: intent.payload as string });
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
