interface RequestTimeoutController {
  timeout: (request: Request, seconds: number) => void;
}

const isLongRunningExtensionRequest = (request: Request) => {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // Agent reads prepare default tools and load their harnesses on first use.
  // Keep that work connected just like an explicit install; ordinary requests keep the server limit.
  if (request.method === "GET" && segments[0] === "v1" && segments[1] === "agents") return true;
  if (request.method !== "POST") return false;

  const isProjectExtensionRoute = segments[0] === "v1" && segments[1] === "projects" && segments[3] === "extensions";
  if (!isProjectExtensionRoute) return false;

  const isUpgrade = segments.length === 6 && segments[5] === "upgrade";
  const isInstall = segments.length === 5 && segments[4] === "install";
  return isUpgrade || isInstall;
};

export const disableExtensionPreparationTimeout = (request: Request, server: object) => {
  if (isLongRunningExtensionRequest(request)) (server as RequestTimeoutController).timeout(request, 0);
};
