import { hydrateRoot } from "react-dom/client";
import "@pstdio/ui/style.css";
import { DesktopLifecycleRoot } from "./desktop-lifecycle-root";

const appInfo = await window.promptStudioDesktop.getAppInfo();

hydrateRoot(document.getElementById("root")!, <DesktopLifecycleRoot platform={appInfo.platform} />);
