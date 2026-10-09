import { existsSync, readFileSync, statSync } from "node:fs";
import { win32 } from "node:path";

type WhichCommand = (command: string) => string | null;
type ExistsCommand = (path: string) => boolean;

export type ResolvedProcessCommand = {
  argv: string[];
  /**
   * Set when `argv` is already fully escaped for `cmd.exe`. The spawner must
   * pass this straight through so it does not re-quote and undo the escaping.
   */
  windowsVerbatimArguments?: true;
};

const hasPathSeparator = (command: string) => command.includes("/") || command.includes("\\");

const endsWithAny = (value: string, suffixes: string[]) => {
  const lower = value.toLowerCase();
  return suffixes.some((suffix) => lower.endsWith(suffix));
};

// npm installs three shims side by side: `foo`, `foo.cmd`, `foo.ps1`. `Bun.which`
// can return the `.ps1` when PATHEXT lists `.PS1` before `.CMD`, and neither
// `Bun.spawn` nor `cmd.exe /c` can launch a `.ps1` — so switch to the sibling
// `.cmd`/`.bat`/`.exe`, which the rest of this function already knows how to run.
const preferSpawnableSibling = (command: string, exists: ExistsCommand) => {
  if (!command.toLowerCase().endsWith(".ps1")) return command;

  const base = command.slice(0, -".ps1".length);
  for (const extension of [".cmd", ".bat", ".exe"]) {
    if (exists(base + extension)) return base + extension;
  }
  return command;
};

const whichCommand: WhichCommand = (command) => {
  if (typeof Bun.which !== "function") return null;
  return Bun.which(command);
};

const findWindowsCommand = (command: string, env: NodeJS.ProcessEnv, cwd: string) => {
  const extensions = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const names = win32.extname(command) ? [command] : extensions.map((extension) => command + extension);
  for (const entry of (env.PATH ?? "").split(";").filter(Boolean)) {
    const directory = entry.replace(/^"(.*)"$/, "$1");
    for (const name of names) {
      const path = win32.resolve(cwd, directory, name);
      try {
        if (statSync(path).isFile()) return path;
      } catch {}
    }
  }
  return null;
};

export const resolveProcessEnvironmentCommand = (
  command: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd = process.cwd(),
) =>
  resolveProcessCommand(
    command,
    (name) =>
      process.platform === "win32"
        ? findWindowsCommand(name, env, cwd)
        : Bun.which(name, { PATH: env.PATH ?? "", cwd }),
    process.platform,
    env.ComSpec,
    existsSync,
    cwd,
  );

// cmd.exe re-parses its command line, so a batch argument containing `&`, `"`,
// `%`, `^`, ... would be reinterpreted (or inject a second command) unless it is
// escaped. Escaping ported from cross-spawn (MIT): quote the token, fix up
// backslash/quote runs, then prefix cmd metacharacters with `^`. npm-style
// shims re-parse `%*` a second time, so those need the metacharacters escaped
// twice.
const CMD_METACHARS = /([()\][%!^"`<>&|;, *?])/g;

const isNpmStyleShim = (path: string) => {
  if (/[\\/](?:\.bin|npm)[\\/][^\\/]+\.(?:cmd|bat)$/i.test(path)) return true;
  // A user-defined npm prefix need not be named "npm". Its wrapper still
  // forwards arguments to a package entry point through a second cmd parse.
  try {
    return /node_modules[^\r\n]*%\*/i.test(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
};

export const escapeForCmd = (arg: string, doubleEscapeMetachars: boolean) => {
  let out = `${arg}`.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"').replace(/(?=(\\+?)?)\1$/, "$1$1");
  out = `"${out}"`.replace(CMD_METACHARS, "^$1");
  return doubleEscapeMetachars ? out.replace(CMD_METACHARS, "^$1") : out;
};

/**
 * Resolve a bare command name to a spawnable argv.
 *
 * `Bun.spawn` needs an absolute path on Windows and, for npm-installed CLIs,
 * finds a `.cmd`/`.bat`/`.ps1` shim it can't execute directly. `.cmd`/`.bat`
 * run through `cmd.exe /c` with every argument escaped for cmd (and the result
 * marked verbatim); a `.ps1` falls back to its sibling shim, or
 * `powershell -File` when it stands alone. Commands that already contain a path
 * separator are resolved relative to the child working directory as well.
 */
export const resolveProcessCommand = (
  command: readonly string[],
  which: WhichCommand = whichCommand,
  platform = process.platform,
  comspec = process.env.ComSpec,
  exists: ExistsCommand = existsSync,
  cwd = process.cwd(),
): ResolvedProcessCommand => {
  const [executable, ...args] = command;
  if (!executable) return { argv: [...command] };
  if (platform !== "win32" && hasPathSeparator(executable)) return { argv: [...command] };

  const resolved = hasPathSeparator(executable) ? win32.resolve(cwd, executable) : which(executable);
  if (!resolved) return { argv: [...command] };
  if (platform !== "win32") return { argv: [resolved, ...args] };

  const target = preferSpawnableSibling(resolved, exists);

  if (endsWithAny(target, [".cmd", ".bat"])) {
    const doubleEscape = isNpmStyleShim(target);
    // The executable is parsed once; only arguments pass through the shim too.
    // Double escaping the path leaves literal carets and quotes in its name.
    const escapedCommand = escapeForCmd(target, false);
    const line = [escapedCommand, ...args.map((arg) => escapeForCmd(arg, doubleEscape))].join(" ");
    return {
      argv: [comspec ?? "cmd.exe", "/d", "/s", "/c", `"${line}"`],
      windowsVerbatimArguments: true,
    };
  }
  if (target.toLowerCase().endsWith(".ps1")) {
    return { argv: ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", target, ...args] };
  }
  return { argv: [target, ...args] };
};
