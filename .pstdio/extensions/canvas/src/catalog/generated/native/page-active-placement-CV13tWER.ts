// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { u as e } from "./workbench-core-N58OeDyx.ts";
// packages/pstdio-workbench/src/core/registries/pages/page-active-placement.ts
var t = (e, t, n) => {
	if (!t) return;
	let r = e.regions.main, i = r.widgets.find((e) => e.widgetId === r.activeWidgetId) ?? r.widgets[0];
	return i && (n?.(i) || i.placementIdentity?.kind === "page" && i.placementIdentity.pageId === t.id) ? i : void 0;
}, n = (n, r, i, a) => {
	let o = t(n, r, a);
	if (!(r?.resource && e(r, o?.resource) !== e(r, i))) return o;
};
export { n, t };
