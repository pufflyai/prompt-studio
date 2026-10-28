import { type HarnessContext, prepareHarnessPackage } from "@pstdio/sdk/extensions";
import { resolveOpencodeCommand, setOpencodePackage } from "./cli";
export const prepareOpencode = async (ctx: HarnessContext) => {
  const acquired = await prepareHarnessPackage(ctx, {
    command: [resolveOpencodeCommand({ managed: () => null })],
    minimumVersion: "1.0.175",
    name: "opencode-ai",
    version: "1.18.34",
  });
  setOpencodePackage(acquired?.path ?? null);
};
