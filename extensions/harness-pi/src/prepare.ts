import { type HarnessContext, prepareHarnessPackage } from "@pstdio/sdk/extensions";
import { resolvePiCommand, setPiPackage } from "./cli";
export const preparePi = async (ctx: HarnessContext) => {
  const global = resolvePiCommand({ managed: () => null });
  const acquired = await prepareHarnessPackage(ctx, {
    ...global,
    minimumVersion: "0.73.1",
    name: "@mariozechner/pi-coding-agent",
    version: "0.73.1",
  });
  setPiPackage(acquired?.path ?? null);
};
