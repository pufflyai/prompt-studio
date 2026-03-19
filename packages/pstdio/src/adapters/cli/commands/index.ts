import * as agentsCommand from "./agents";
import * as closeCommand from "./close";
import * as hooksCommand from "./hooks";
import * as projectsCommand from "./projects";
import * as serveCommand from "./serve";
import * as sessionsCommand from "./sessions";
import * as statusesCommand from "./statuses";
import * as tagsCommand from "./tags";
import * as templatesCommand from "./templates";
import * as ticketsCommand from "./tickets";
import * as workspaceCommand from "./workspace";

export const topLevelCommandModules = [
  agentsCommand,
  closeCommand,
  hooksCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  statusesCommand,
  tagsCommand,
  templatesCommand,
  ticketsCommand,
  workspaceCommand,
];
