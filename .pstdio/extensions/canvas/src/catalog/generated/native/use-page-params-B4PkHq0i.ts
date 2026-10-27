// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { J as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./use-workbench-store-BMaFgEbb.ts";
import { t as n } from "./shallow-BYHDNLn2.ts";
import { createContext as r, useContext as i, useLayoutEffect as a, useRef as o } from "react";
// packages/pstdio-workbench/src/react/renderers/use-page-params.ts
var s = r(void 0), c = (r, c) => {
	let l = c?.placementIdentity, u = c?.pageContext, d = i(s), f = l?.kind === "page" ? l.pageId : void 0, p = t(r.pages.store, (e) => u ? Object.values(e.pages).find((e) => e.ref.id === u.page.id && e.ref.extensionId === u.page.extensionId)?.id : l ? f : d), m = t(r.pages.store, (e) => e.projectId), h = t(r.pages.store, n((t) => p && (u || p === t.activePageId) ? e(t.pages[p]?.params, u ? u.params : t.location?.params) : void 0)), g = o(void 0);
	if (a(() => {
		p && h && (g.current = {
			pageId: p,
			projectId: m,
			params: h
		});
	}, [
		p,
		m,
		h
	]), !p) return;
	let _ = g.current;
	return h ?? (_?.pageId === p && _.projectId === m ? _.params : void 0);
};
export { c as n, s as t };
