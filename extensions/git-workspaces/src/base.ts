import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { git } from "./git";

export const resolveBase = async (ctx: ExtensionContextBase, root: string, base: string) => {
  const exists = async (ref: string) => {
    const result = await ctx.process.run({
      command: ["git", "rev-parse", "--verify", "--end-of-options", ref],
      cwd: root,
    });
    return result.exitCode === 0;
  };
  const fetch = async (ref: string) => {
    const slash = ref.indexOf("/");
    if (slash < 1) return;
    // An unreachable remote keeps the last locally known revision, as ordinary offline Git work does.
    await ctx.process.run({ command: ["git", "fetch", ref.slice(0, slash), ref.slice(slash + 1)], cwd: root });
  };
  if (base !== "HEAD") {
    if (await exists(`refs/remotes/${base}`)) await fetch(base);
    else {
      const upstream = await ctx.process.run({
        command: ["git", "rev-parse", "--abbrev-ref", `${base}@{upstream}`],
        cwd: root,
      });
      if (!upstream.exitCode) {
        const ref = upstream.stdout.trim();
        await fetch(ref);
        const ancestor = await ctx.process.run({
          command: ["git", "merge-base", "--is-ancestor", base, ref],
          cwd: root,
        });
        if (!ancestor.exitCode) base = ref;
      }
    }
  }
  return git(ctx, ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`], root);
};
