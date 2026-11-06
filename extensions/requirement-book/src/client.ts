import { createWebviewClient } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
export const makeClient = (host: Parameters<typeof createWebviewClient>[0]) =>
  createWebviewClient<typeof commands>(host);
export type BookClient = ReturnType<typeof makeClient>;
