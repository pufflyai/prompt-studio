import * as agentsCommand from "./agents";
import * as closeCommand from "./close";
import * as projectsCommand from "./projects";
import * as templatesCommand from "./templates";
import * as ticketsCommand from "./tickets";
import * as tuiCommand from "./tui";
import * as workspaceCommand from "./workspace";

export const topLevelCommandModules = [
  agentsCommand,
  closeCommand,
  projectsCommand,
  templatesCommand,
  ticketsCommand,
  tuiCommand,
  workspaceCommand,
];
