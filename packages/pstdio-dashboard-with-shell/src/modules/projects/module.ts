import type { ShellModuleContribution } from "pstdio-shell/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-shell/core";
import { createElement } from "react";
import {
  PROJECT_ICON,
  PROJECT_RESOURCE_KIND,
  PROJECT_SELECTOR_WIDGET_ID,
  PROJECTS_MODULE_ID,
  PROJECTS_OPEN_CREATE_COMMAND_ID,
  PROJECTS_OPEN_CREATE_REQUEST_CONTEXT_KEY,
  PROJECTS_OPEN_LIST_COMMAND_ID,
  PROJECTS_OPEN_LIST_REQUEST_CONTEXT_KEY,
  PROJECTS_SELECT_COMMAND_ID,
  SELECTED_PROJECT_CONTEXT_KEY,
} from "./constants";
import { ProjectSelector } from "./widgets/project-selector";

export * from "./constants";
export { useCreateProject } from "./data/api";
export { useProjects } from "./data/use-projects";
export type { CreateProjectInput, Project } from "./types";

export const createProjectsModule = (): ShellModuleContribution => ({
  id: PROJECTS_MODULE_ID,
  activate(ctx) {
    let dialogRequestId = 0;
    const requestDialog = (contextKey: string) => {
      dialogRequestId += 1;
      ctx.context.set(contextKey, dialogRequestId);
    };

    ctx.resources.registerKind({ kind: PROJECT_RESOURCE_KIND, label: "Project", icon: PROJECT_ICON });

    ctx.layout.registerWidget({
      id: PROJECT_SELECTOR_WIDGET_ID,
      title: "Project selector",
      area: "left-header",
      singleton: true,
      rendererId: PROJECT_SELECTOR_WIDGET_ID,
    });

    ctx.renderers.registerRenderer({
      id: PROJECT_SELECTOR_WIDGET_ID,
      render: (input) => createElement(ProjectSelector, { input }),
    });

    ctx.commands.registerCommand(
      {
        id: PROJECTS_SELECT_COMMAND_ID,
        label: "Select project",
        category: "Projects",
        icon: PROJECT_ICON,
      },
      {
        execute: (projectId: string) => {
          if (typeof projectId !== "string" || projectId.length === 0) return;
          ctx.context.set(SELECTED_PROJECT_CONTEXT_KEY, projectId);
        },
      },
    );

    ctx.commands.registerCommand(
      {
        id: PROJECTS_OPEN_LIST_COMMAND_ID,
        label: "Show projects",
        category: "Projects",
        icon: PROJECT_ICON,
      },
      {
        execute: () => requestDialog(PROJECTS_OPEN_LIST_REQUEST_CONTEXT_KEY),
      },
    );

    ctx.commands.registerCommand(
      {
        id: PROJECTS_OPEN_CREATE_COMMAND_ID,
        label: "Create project",
        category: "Projects",
        icon: "Plus",
      },
      {
        execute: () => requestDialog(PROJECTS_OPEN_CREATE_REQUEST_CONTEXT_KEY),
      },
    );

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: PROJECTS_OPEN_LIST_COMMAND_ID,
      order: 10,
    });

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: PROJECTS_OPEN_CREATE_COMMAND_ID,
      order: 11,
    });
  },
});
