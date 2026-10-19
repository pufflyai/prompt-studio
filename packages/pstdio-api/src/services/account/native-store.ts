import { canonicalJson } from "pstdio-sync-contracts";
import { configSchema, type RelayWorkbench } from "../relay/config";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

export const assertSameOwner = (current: RelayWorkbench, next: Omit<RelayWorkbench, "renewalGrant">) => {
  const { renewalGrant: _, ...owner } = current;
  if (canonicalJson(owner) !== canonicalJson(next)) throw new Error("Native relay owner mismatch");
};
export const createNativeStore = (path: string) => {
  const read = () => readPrivateFile(path, configSchema, { connections: [] });
  return {
    read,
    connect: (input: RelayWorkbench) =>
      serializeNativeWrite(path, async () => {
        const next = configSchema.shape.connections.element.parse(input);
        const config = await read();
        const current = config.connections.find((entry) => entry.workbenchId === next.workbenchId);
        const { renewalGrant: _, ...owner } = next;
        if (current) assertSameOwner(current, owner);
        config.connections = [...config.connections.filter((entry) => entry.workbenchId !== next.workbenchId), next];
        await writePrivateFile(path, config);
      }),
  };
};
