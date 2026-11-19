import { type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { git } from "./git";

export const discoverGitWorkspace = async (ctx: Pick<ExtensionContextBase, "workspaces" | "process">) => {
  const home = await ctx.workspaces.getDefault();
  if (home?.executionKind !== "local" || !home.rootPath) return null;
  try {
    const probe = await ctx.process.run({
      command: ["git", "rev-parse", "--verify", "HEAD^{commit}"],
      cwd: home.rootPath,
    });
    if (probe.exitCode) return null;
  } catch {
    return null;
  }
  const output = await git(
    ctx,
    ["for-each-ref", "--sort=refname", "--format=%(refname:short)\t%(HEAD)", "refs/heads", "refs/remotes"],
    home.rootPath,
  );
  const head = await git(ctx, ["rev-parse", "--abbrev-ref", "HEAD"], home.rootPath);
  const current = head === "HEAD" ? "" : head;
  const branches = output
    ? output.split("\n").map((line) => {
        const [name, head] = line.split("\t");
        return { name: name!, current: head === "*" };
      })
    : [];
  const branchOptions = branches
    .filter((branch) => current || !branch.current)
    .map((branch) => ({
      label: branch.name,
      value: branch.name,
      icon: "git-commit-horizontal",
    }));
  const options = [
    ...(!current ? [{ label: "HEAD", value: "HEAD", icon: "git-commit-horizontal" }] : []),
    ...branchOptions,
  ];
  return {
    params: {
      base: params.select({
        label: l10n("params.base", "Base branch"),
        required: true,
        allowCustomValues: true,
        ...(!current
          ? { description: l10n("params.detached-base", "HEAD selects the current checkout (no branch).") }
          : {}),
        defaultValue: current ? (branches.find((branch) => branch.current)?.name ?? current) : "HEAD",
        options,
      }),
    },
  };
};
