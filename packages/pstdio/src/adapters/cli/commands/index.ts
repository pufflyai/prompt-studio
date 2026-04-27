import type { CommandModule } from "yargs";
import * as closeCommand from "./close";
import * as extensionsCommand from "./extensions";
import * as harnessesCommand from "./harnesses";
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
  closeCommand,
  extensionsCommand,
  harnessesCommand,
  pluginsCommand,
  projectsCommand,
  serveCommand,
  sessionsCommand,
  statusesCommand,
  tagsCommand,
  templatesCommand,
  ticketsCommand,
  workspaceCommand,
] as CommandModule[];

export const topLevelCommandModules = [...staticTopLevelCommandModules];

export const topLevelStaticCommandNames = staticTopLevelCommandModules.map((commandModule) => {
  const command = Array.isArray(commandModule.command) ? commandModule.command[0] : commandModule.command;
  const [name] = command.split(" ");
  return name;
});
