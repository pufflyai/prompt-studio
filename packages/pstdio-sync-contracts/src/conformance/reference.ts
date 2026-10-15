import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Scope } from "../wire";
import { createClient } from "./client";
import { createLocalStore } from "./local-store";
import { createConformanceServices } from "./services";

export async function createReferenceFixture(databaseUrl: string, objectEndpoint: string) {
  const root = await mkdtemp(join(tmpdir(), "sync-conformance-"));
  const services = await createConformanceServices(databaseUrl, objectEndpoint);
  const { relay, objects } = services;
  const stores = await Promise.all(["a", "b", "c"].map((id) => createLocalStore(join(root, id))));
  return {
    scenario(
      scope: Scope = { accountId: "test-owner", workbenchId: crypto.randomUUID(), extensionId: "test-extension" },
    ) {
      return {
        scope,
        clients: stores.map((store, index) => createClient(scope, ["a", "b", "c"][index], store, relay, objects)),
        relay,
        objects,
      };
    },
    async close() {
      await Promise.all(stores.map((store) => store.close()));
      await services.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
export type ConformanceCase = ReturnType<Awaited<ReturnType<typeof createReferenceFixture>>["scenario"]>;
export type ConformanceFactory = () => ConformanceCase;
