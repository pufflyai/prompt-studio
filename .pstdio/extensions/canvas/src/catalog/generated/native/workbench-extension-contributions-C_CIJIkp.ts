// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e } from "./collections-W65OWXaL.ts";
import { n as t } from "./runtime-state-Di93_TAk.ts";
import "./extension-localization-DzVq3_HP.ts";
import { workbenchResourceKindDefinitions as n } from "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/shared/extensions/workbench-extension-contributions.ts
var r = "dashboard.activeResource.kind", i = "dashboard.activeResource.id", a = "dashboard.templates.editable", o = t(() => ({
	listeners: /* @__PURE__ */ new Set(),
	projects: /* @__PURE__ */ new Map()
}), (e) => {
	e.listeners.clear(), e.projects.clear();
}), s = (t, n = e()) => t ? o(n).projects.get(t) : void 0;
Object.values(n);
export { s as i, r as n, a as r, i as t };
