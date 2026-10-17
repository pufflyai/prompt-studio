import { createObjects } from "./objects";
import { createRelay } from "./relay";

export const createConformanceServices = async (databaseUrl: string, objectEndpoint: string) => {
  if (!databaseUrl || !objectEndpoint)
    throw new Error(
      "Conformance services require the isolated database and object endpoints. Run scripts/isolated.ts.",
    );
  const objects = createObjects(objectEndpoint);
  await objects.initialize();
  const relay = await createRelay(databaseUrl, objects);
  return {
    relay,
    objects,
    async close() {
      await relay.close();
      objects.close();
    },
  };
};
