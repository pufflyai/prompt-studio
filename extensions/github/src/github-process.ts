import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

let active = 0;
const waiting: (() => void)[] = [];

// The owner bounds child processes across commands, including simultaneous ticket queries.
export const runGithub = async (
  ctx: Pick<ExtensionContextBase, "process">,
  input: Parameters<ExtensionContextBase["process"]["run"]>[0],
) => {
  if (active < 8) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await ctx.process.run(input);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
};
