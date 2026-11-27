interface RequestTimeoutController {
  timeout: (request: Request, seconds: number) => void;
}

const isLongRunningExtensionRequest = (request: Request) => {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // Agent reads prepare default tools and load their harnesses on first use.
  // Keep that work connected just like an explicit install; ordinary requests keep the server limit.
  if (request.method === "GET" && segments[0] === "v1" && segments[1] === "agents") return true;

  if (segments[0] !== "v1" || segments[1] !== "projects") return false;
  // Opening a recovered project provisions its folder and extensions before replying.
  if (segments.length === 4 && segments[3] === "open" && request.method === "POST") return true;
  if (segments[3] === "boards" && request.method === "GET") {
    // Listing saved views resolves their fields through the extension's renderer.
    return segments.length === 6 && segments[5] === "views";
  }
  if (segments[3] !== "extensions") return false;
  if (request.method === "GET") {
    // Inventory and workbench metadata can both wait for cold extension preparation.
    return segments.length === 4 || (segments.length === 5 && ["ui", "appearance"].includes(segments[4]!));
  }
  if (request.method !== "POST") return false;

  const preparesSource = segments.length === 6 && (segments[5] === "upgrade" || segments[5] === "reload");
  const isInstall = segments.length === 5 && segments[4] === "install";
  return preparesSource || isInstall;
};

export const disableExtensionPreparationTimeout = (request: Request, server: object) => {
  if (isLongRunningExtensionRequest(request)) (server as RequestTimeoutController).timeout(request, 0);
};
