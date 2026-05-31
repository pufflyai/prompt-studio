import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createWorkbenchLastResourceController, type LastResourcePersistenceAdapter } from "./last-resource-controller";

const createMemoryPersistence = (initial?: ResourceRef): LastResourcePersistenceAdapter => {
  let value = initial;
  return {
    getLastResource: () => value,
    setLastResource: (resource) => {
      value = resource;
    },
  };
};

const sampleResource: ResourceRef = { kind: "ticket", uri: "ticket://PS-1", label: "PS-1" };

describe("createWorkbenchLastResourceController", () => {
  test("returns false from restore when nothing is persisted", async () => {
    const controller = createWorkbenchLastResourceController({
      openResource: async () => undefined,
    });

    expect(await controller.restore()).toBe(false);
  });

  test("replays the persisted resource through the opener", async () => {
    const opened: ResourceRef[] = [];
    const controller = createWorkbenchLastResourceController({
      persistence: createMemoryPersistence(sampleResource),
      openResource: async (resource) => {
        opened.push(resource);
      },
    });

    expect(await controller.restore()).toBe(true);
    expect(opened).toEqual([sampleResource]);
  });

  test("returns false when the opener throws", async () => {
    const controller = createWorkbenchLastResourceController({
      persistence: createMemoryPersistence(sampleResource),
      openResource: async () => {
        throw new Error("kind not registered");
      },
    });

    expect(await controller.restore()).toBe(false);
  });

  test("set writes through to the adapter", () => {
    const persistence = createMemoryPersistence();
    const controller = createWorkbenchLastResourceController({
      persistence,
      openResource: async () => undefined,
    });

    controller.set(sampleResource);
    expect(persistence.getLastResource()).toEqual(sampleResource);

    controller.set(undefined);
    expect(persistence.getLastResource()).toBeUndefined();
  });
});
