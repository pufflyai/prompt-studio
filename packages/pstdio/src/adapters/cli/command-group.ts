import type { Argv, CommandModule } from "yargs";

// Each subcommand module types its own arguments, so the group only needs its name.
// The CommandModule member keeps inline subcommands contextually typed.
// biome-ignore lint/suspicious/noExplicitAny: inline subcommands read untyped yargs arguments
type Subcommand = CommandModule<any, any> | { readonly command: string };

interface CommandGroupInput {
  name: string;
  describe: string;
  subcommands: Subcommand[];
}

/**
 * A group only routes to its subcommands. Without one it prints its help, so
 * it never needs the API (see `commandGroupPaths`).
 */
export const defineCommandGroup = ({ name, describe, subcommands }: CommandGroupInput) => {
  let groupYargs: Argv;
  return {
    command: `${name} [command]`,
    describe,
    subcommands,
    builder: (yargs: Argv) => {
      groupYargs = yargs;
      for (const subcommand of subcommands) yargs.command(subcommand as CommandModule);
      // The optional [command] positional also receives mistyped subcommands.
      // Reject them like any other unknown argument instead of printing help as a success.
      return yargs.check((argv) => argv.command === undefined || `Unknown argument: ${argv.command}`, false);
    },
    // Help for a bare group is a successful answer, so it goes to stdout like `--help`.
    handler: () => {
      groupYargs.showHelp("log");
    },
  };
};

interface CommandModuleLike {
  command?: string | readonly string[];
  subcommands?: readonly CommandModuleLike[];
}

const commandName = (module: CommandModuleLike) => {
  const command = Array.isArray(module.command) ? module.command[0] : module.command;
  return typeof command === "string" ? command.split(" ")[0] : undefined;
};

/** Paths such as `auth tokens` that name a command group rather than a runnable command. */
export const commandGroupPaths = (modules: readonly CommandModuleLike[], parent: string[] = []): string[] =>
  modules.flatMap((module) => {
    const name = commandName(module);
    if (!name || !module.subcommands) return [];
    const path = [...parent, name];
    return [path.join(" "), ...commandGroupPaths(module.subcommands, path)];
  });
