import type { MutableRefObject } from "react";
import { createDashboardProjectShell, PROJECT_SETTINGS_WIDGET_ID } from "@/shared/shell/dashboard-project-shell";
import {
  type BuildProjectSettingsTreeSectionsInput,
  buildProjectSettingsTreeSections,
  createProjectSettingsSectionResource,
  PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
  PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
  PROJECT_SETTINGS_SECTION_OPENER_ID,
  PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
  PROJECT_SETTINGS_TREE_ID,
  parseProjectSettingsSectionResource,
} from "../components/settings-navigation-tree";
import type { SettingsSection } from "./settings-section";

export const PROJECT_SETTINGS_BACK_WIDGET_ID = "project.settings.back";

export interface ProjectSettingsNavigationState extends BuildProjectSettingsTreeSectionsInput {
  onCreateTag: () => void;
  onCreateTemplate: () => void;
  onOpenSection: (section: SettingsSection) => void;
}

interface CreateProjectSettingsShellInput {
  projectId: string;
  projectName: string;
  initialSection: SettingsSection;
  navigation: MutableRefObject<ProjectSettingsNavigationState>;
  navigate: (path: string) => void;
}

export const createProjectSettingsShell = (input: CreateProjectSettingsShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    showProjectNavigationTree: false,
  });
  const sectionResource = createProjectSettingsSectionResource(input.projectId, input.initialSection);
  const disposables = [
    shell.resources.registerKind({
      kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      label: "Project settings section",
      icon: "Settings",
    }),
    shell.layout.registerWidget({
      id: PROJECT_SETTINGS_BACK_WIDGET_ID,
      title: "Back to dashboard",
      area: "left-header",
      singleton: true,
      renderer: "react",
      rendererId: PROJECT_SETTINGS_BACK_WIDGET_ID,
    }),
    shell.trees.registerTreeView({
      id: PROJECT_SETTINGS_TREE_ID,
      title: "Project settings",
      area: "left",
      areaSize: { defaultPx: 320, minPx: 200 },
      icon: "Settings",
      getRoots: () => [],
      getChildren: () => [],
      getSections: () => buildProjectSettingsTreeSections(input.navigation.current),
    }),
    shell.resources.registerOpener({
      id: PROJECT_SETTINGS_SECTION_OPENER_ID,
      priority: 100,
      canOpen: (resource) => resource.kind === PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
      open: (resource, openInput) => {
        input.navigation.current.onOpenSection(parseProjectSettingsSectionResource(resource));
        return shell.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, {
          resource,
          replaceActive: openInput.replaceActive,
          closable: false,
        });
      },
    }),
    shell.commands.registerCommand(
      {
        id: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
        label: input.navigation.current.labels.createTag,
        category: "Project settings",
        icon: "Plus",
      },
      { execute: () => input.navigation.current.onCreateTag() },
    ),
    shell.commands.registerCommand(
      {
        id: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
        label: input.navigation.current.labels.createTemplate,
        category: "Project settings",
        icon: "Plus",
      },
      { execute: () => input.navigation.current.onCreateTemplate() },
    ),
  ];

  shell.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, {
    resource: sectionResource,
    closable: false,
  });
  shell.layout.openWidget(PROJECT_SETTINGS_BACK_WIDGET_ID, {
    closable: false,
  });

  return {
    ...shell,
    dispose: () => {
      for (const disposable of disposables) disposable.dispose();
      shell.dispose();
    },
  };
};
