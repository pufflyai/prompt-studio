import type { MenuPath } from "pstdio-workbench/core";

export const dashboardHelpMenuPath = ["dashboardWorkbench", "help"] as const satisfies MenuPath;

export const dashboardWorkspaceMenuPath = ["dashboardWorkbench", "workspace"] as const satisfies MenuPath;
