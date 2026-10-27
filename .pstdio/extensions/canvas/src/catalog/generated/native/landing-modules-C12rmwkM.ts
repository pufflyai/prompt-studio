// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createElement as e, lazy as t } from "react";
// clients/landing-page/src/services/deferred-module.ts
var n = (e) => {
	let t;
	return () => (t ??= e().catch((e) => {
		throw t = void 0, e;
	}), t);
}, r = (r) => {
	let i, a = n(async () => {
		let e = await r();
		return i = e.default, e;
	}), o = t(a);
	return {
		Component: (t) => e(typeof window > "u" ? i : o, t),
		preload: a
	};
}, i = r(async () => ({ default: (await import("./shader-editor-demo-B_dcsCr4.ts").then((e) => e.n)).ShaderEditorDemo })), a = r(async () => ({ default: (await import("./agent-dashboard-demo-EcEJUJma.ts")).AgentDashboardDemo })), o = r(async () => ({ default: (await import("./formula-glossary-demo-B7WAfD2j.ts")).FormulaGlossaryDemo })), s = r(async () => ({ default: (await import("./what-is-prompt-studio-view-CPuMWmPK.ts")).WhatIsPromptStudioView })), c = r(async () => ({ default: (await import("./examples-view-BFuSkg3v.ts")).ExamplesView })), l = r(async () => ({ default: (await import("./features-view-BkKQ7Xtr.ts")).FeaturesView })), u = r(async () => ({ default: (await import("./reading-content-BHnG4JXx.ts")).ReadingContent })), d = r(async () => ({ default: (await import("./docs-sidebar-BHqLpLi2.ts")).DocsSidebar })), f = r(async () => ({ default: (await import("./blog-sidebar-CFFaqsWq.ts")).BlogSidebar })), p = r(async () => ({ default: (await import("./command-palette-modal-DGQ6ezBB.ts")).CommandPaletteModal }));
export { c as a, u as c, d as i, i as l, f as n, l as o, p as r, o as s, a as t, s as u };
