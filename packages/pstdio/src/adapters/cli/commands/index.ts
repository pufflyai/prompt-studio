import * as agentsCommand from "./agents";
import * as authCommand from "./auth";
import * as automationCommand from "./automation";
import * as closeCommand from "./close";
import * as connectionsCommand from "./connections";
import * as extensionsCommand from "./extensions";
import * as inboxCommand from "./inbox";
import * as logsCommand from "./logs";
import * as notificationsCommand from "./notifications";
import * as projectsCommand from "./projects";
import * as serveCommand from "./serve";
import * as sessionsCommand from "./sessions";
import * as templatesCommand from "./templates";
import * as workspaceCommand from "./workspace";

export const topLevelCommandModules = [
  agentsCommand,
  authCommand,
  automationCommand,
  closeCommand,
  connectionsCommand,
  extensionsCommand,
  inboxCommand,
  logsCommand,
  notificationsCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  templatesCommand,
  workspaceCommand,
];
