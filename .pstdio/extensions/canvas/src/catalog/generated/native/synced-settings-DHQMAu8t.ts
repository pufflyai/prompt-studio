// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, o as t } from "./collections-W65OWXaL.ts";
// packages/pstdio-dashboard/src/shared/settings/synced-settings.ts
var n = () => e("settings").state.get("global"), r = (e) => t("settings").upsert({
	id: "global",
	...e
}), i = () => n()?.notifications_enabled === !0, a = () => n()?.machine_tokens_enabled === !0;
export { r as i, i as n, n as r, a as t };
