import type { CreateWorkbenchPageLocationControllerInput } from "./page-location-types";

export const configuredDefaultPage = <Value>(input: CreateWorkbenchPageLocationControllerInput<Value>) =>
  typeof input.defaultPage === "function" ? input.defaultPage() : input.defaultPage;

export const eligibleDefaultPage = <Value>(input: CreateWorkbenchPageLocationControllerInput<Value>) => {
  const ref = configuredDefaultPage(input);
  if (!ref) return undefined;
  return input.registry
    .listPages()
    .find((page) => page.ref.extensionId === ref.extensionId && page.ref.id === ref.id && !page.resource);
};
