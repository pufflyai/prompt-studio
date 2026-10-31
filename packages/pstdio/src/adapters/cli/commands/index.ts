import * as agentsCommand from "./agents";
import * as authCommand from "./auth";
import * as automationCommand from "./automation";
import * as closeCommand from "./close";
import * as connectionsCommand from "./connections";
import * as devicesCommand from "./devices";
import * as extensionsCommand from "./extensions";
import * as inboxCommand from "./inbox";
import * as loginCommand from "./login";
import * as logoutCommand from "./logout";
import * as logsCommand from "./logs";
import * as notificationsCommand from "./notifications";
import * as onboardingCommand from "./onboarding";
import * as performanceCommand from "./performance";
import { performanceObserverCommand } from "./performance-observer";
import * as projectsCommand from "./projects";
import * as resourcesCommand from "./resources";
import * as serveCommand from "./serve";
import * as sessionsCommand from "./sessions";
import * as updateChannelCommand from "./update-channel";
import * as viewsCommand from "./views";
import * as workspaceCommand from "./workspace";

export const topLevelCommandModules = [
  agentsCommand,
  authCommand,
  automationCommand,
  closeCommand,
  connectionsCommand,
  devicesCommand,
  extensionsCommand,
  inboxCommand,
  loginCommand,
  logoutCommand,
  logsCommand,
  notificationsCommand,
  onboardingCommand,
  performanceCommand,
  performanceObserverCommand,
  viewsCommand,
  projectsCommand,
  resourcesCommand,
  serveCommand,
  sessionsCommand,
  updateChannelCommand,
  workspaceCommand,
];

export const topLevelCommandNames = topLevelCommandModules.map(({ command }) => command.split(" ")[0]);
