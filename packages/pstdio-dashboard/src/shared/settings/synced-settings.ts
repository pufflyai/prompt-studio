import type { Settings } from "@pstdio/sdk/api";
import { getCollection, getWriter } from "@/lib/sync/collections";

export const readSettings = () =>
  getCollection("settings").state.get("global") as (Settings & { id: string }) | undefined;

export const receiveSettings = (settings: Settings) => getWriter("settings")!.upsert({ id: "global", ...settings });

export const notificationsEnabled = () => readSettings()?.notifications_enabled === true;
