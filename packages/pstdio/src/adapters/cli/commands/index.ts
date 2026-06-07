import * as agentsCommand from "./agents";
import * as closeCommand from "./close";
import * as extensionsCommand from "./extensions";
import * as logsCommand from "./logs";
import * as projectsCommand from "./projects";
import * as serveCommand from "./serve";
import * as sessionsCommand from "./sessions";
import * as templatesCommand from "./templates";
import * as workspaceCommand from "./workspace";

export const topLevelCommandModules = [
  agentsCommand,
  closeCommand,
  extensionsCommand,
  logsCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  templatesCommand,
  workspaceCommand,
];
