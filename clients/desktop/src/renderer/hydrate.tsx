import { hydrateRoot } from "react-dom/client";
import { DesktopLifecycleRoot } from "./desktop-lifecycle-root";

const [appInfo, appearance] = await Promise.all([
  window.promptStudioDesktop.getAppInfo(),
  window.promptStudioDesktop.getStartupAppearance(),
]);

hydrateRoot(
  document.getElementById("root")!,
  <DesktopLifecycleRoot platform={appInfo.platform} initialAppearance={appearance} />,
);
