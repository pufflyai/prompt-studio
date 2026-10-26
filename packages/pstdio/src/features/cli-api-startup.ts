const LOCAL_COMMANDS = new Set(["close", "logs", "performance", "performance-observer", "serve"]);
const LOCAL_EXTENSION_COMMANDS = new Set(["add", "check", "install-browser", "pack", "test"]);

/** `groupPaths` lists command groups, such as `auth tokens`, which only print help. */
export const shouldEnsureApiForCommand = (argv: { _: unknown[] }, groupPaths: ReadonlySet<string>) => {
  const [topLevel, subcommand] = argv._;
  if (typeof topLevel !== "string") return true;
  if (LOCAL_COMMANDS.has(topLevel)) return false;
  if (groupPaths.has(argv._.join(" "))) return false;
  if (topLevel === "extensions" && typeof subcommand === "string") {
    return !LOCAL_EXTENSION_COMMANDS.has(subcommand);
  }
  return true;
};
