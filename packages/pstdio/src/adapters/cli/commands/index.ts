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
import * as viewsCommand from "./views";
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
  viewsCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  workspaceCommand,
];

export const topLevelCommandNames = topLevelCommandModules.map(({ command }) => command.split(" ")[0]);
