import type { ExtensionViewRenderContext, WebviewClient } from "@pstdio/sdk/extensions";
import { createContext, useContext } from "react";
import type { cloudCommands } from "./project-state";

export type CloudClient = WebviewClient<typeof cloudCommands>;
export const CloudContext = createContext<{
  client: CloudClient;
  t: ExtensionViewRenderContext["t"];
} | null>(null);

export const useCloudContext = () => {
  const context = useContext(CloudContext);
  if (!context) throw new Error("Cloud view is not mounted");
  return context;
};
