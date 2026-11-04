export const productionServiceImages = (loaded: Array<{ service: string; image: string }>) =>
  Object.fromEntries(loaded.map(({ service, image }) => [service === "account-manager" ? "manager" : service, image]));
