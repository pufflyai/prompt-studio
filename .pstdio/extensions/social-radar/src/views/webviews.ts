import { artifactsRead, defineView, packageAsset } from "@pstdio/sdk/extensions";
import { postMedia, threadMedia } from "../store";

export const analysisView = defineView({
  id: "analysis",
  title: "Social radar",
  icon: "radar",
  body: {
    kind: "webview",
    entry: packageAsset("../analysis/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});

export const threadView = defineView({
  id: "thread",
  title: "Thread",
  icon: "message-square",
  body: {
    kind: "webview",
    entry: packageAsset("../thread/main.tsx", import.meta.url),
    capabilities: [
      "commands.execute",
      "navigation.open",
      "clipboard.write",
      artifactsRead(postMedia),
      artifactsRead(threadMedia),
    ],
  },
});

export const threadSummaryView = defineView({
  id: "thread-summary",
  title: "Summary",
  icon: "chart-no-axes-column",
  body: {
    kind: "webview",
    entry: packageAsset("../thread/summary-main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
