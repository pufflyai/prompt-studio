import type { LoadedExtensionSource } from "../loader";
import { loadExtensionPackage } from "../loader";
import { createOwnerEndpoint } from "./endpoint";
import { readPreparedExtensionEntry, restorePreparedExtensionDefinition } from "./prepared-entry";
import type { OwnerMessage } from "./protocol";

export const runExtensionOwner = () => {
  const endpoint = createOwnerEndpoint((message) => process.send?.(message));
  endpoint.register(async (input) => {
    const { path, prepared, previous, sourceKind, apiProvider } = input as {
      path: string;
      prepared?: { entryPath: string; packagePath: string };
      previous?: Omit<LoadedExtensionSource, "definition">;
      sourceKind?: LoadedExtensionSource["sourceKind"];
      apiProvider?: "host" | "pst";
    };
    if (prepared && previous) {
      const module = await restorePreparedExtensionDefinition(prepared, path);
      return { source: { ...previous, definition: module.default }, diagnostics: [], prepared };
    }
    const diagnostics: Parameters<typeof loadExtensionPackage>[1] = [];
    const source = await loadExtensionPackage({ path, sourceKind }, diagnostics, { apiProvider });
    return { source, diagnostics, prepared: readPreparedExtensionEntry(path) };
  }, "load");
  process.on("message", (message) => {
    void endpoint.receive(message as OwnerMessage).catch(() => process.exit(1));
  });
  process.on("disconnect", () => process.exit(0));
};
