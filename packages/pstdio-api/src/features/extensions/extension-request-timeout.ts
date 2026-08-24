interface RequestTimeoutController {
  timeout: (request: Request, seconds: number) => void;
}

const isLongRunningExtensionMutation = (request: Request) => {
  if (request.method !== "POST") return false;

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const isProjectExtensionRoute = segments[0] === "v1" && segments[1] === "projects" && segments[3] === "extensions";
  if (!isProjectExtensionRoute) return false;

  const isUpgrade = segments.length === 6 && segments[5] === "upgrade";
  const isMarketplaceInstall = segments.length === 7 && segments[4] === "marketplace" && segments[6] === "install";
  return isUpgrade || isMarketplaceInstall;
};

export const disableExtensionMutationTimeout = (request: Request, server: object) => {
  if (isLongRunningExtensionMutation(request)) (server as RequestTimeoutController).timeout(request, 0);
};
