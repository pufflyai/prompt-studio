import { createOwnerEndpoint } from "../owner/endpoint";
import type { OwnerMessage } from "../owner/protocol";
import { preparationOperations } from "./operations";

// Only trusted host operations run here. No extension entry or callback is imported.
export const runExtensionPreparation = () => {
  const endpoint = createOwnerEndpoint((message) => process.send?.(message));
  for (const [name, operation] of Object.entries(preparationOperations)) {
    endpoint.register(operation as (...args: unknown[]) => unknown, name);
  }
  process.on("message", (message) => {
    void endpoint.receive(message as OwnerMessage).catch(() => process.exit(1));
  });
  process.on("disconnect", () => process.exit(0));
};
