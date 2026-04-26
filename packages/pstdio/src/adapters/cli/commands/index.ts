import * as agentsCommand from "./agents";
import * as closeCommand from "./close";
import * as extensionsCommand from "./extensions";
import * as pluginsCommand from "./plugins";
import * as projectsCommand from "./projects";
import * as serveCommand from "./serve";
import * as sessionsCommand from "./sessions";
import * as statusesCommand from "./statuses";
import * as tagsCommand from "./tags";
import * as templatesCommand from "./templates";
import * as ticketsCommand from "./tickets";
import * as workspaceCommand from "./workspace";

const staticTopLevelCommandModules = [
  agentsCommand,
  closeCommand,
  extensionsCommand,
  pluginsCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  statusesCommand,
  tagsCommand,
  templatesCommand,
  ticketsCommand,
  workspaceCommand,
];

export const topLevelCommandModules = [...staticTopLevelCommandModules];

export const topLevelStaticCommandNames = staticTopLevelCommandModules.map((commandModule) => {
  const [name] = commandModule.command.split(" ");
  return name;
});
