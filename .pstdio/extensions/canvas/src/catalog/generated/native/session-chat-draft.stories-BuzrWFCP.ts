// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { a as n, o as r, s as i, t as a } from "./test-CYwQ_LKY.ts";
import { t as o } from "./workbench-core-N58OeDyx.ts";
import { t as s } from "./widget-ids-CvvbLhYP.ts";
import { t as c } from "./workbench-BYYWgWSr.ts";
import { o as l } from "./project-context-BR7AjHlE.ts";
import { t as u } from "./commands-Bp5w85f4.ts";
import { v as d, y as f } from "./dashboard-workspaces-MEnQd3Xj.ts";
import { t as p } from "./module-DwWTLgjb.ts";
import { n as m, r as h, t as g } from "./module-d530V8j6.ts";
import { useState as _ } from "react";
import { Box as v } from "@chakra-ui/react";
import { jsx as y } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/bubble/open-side-panel.ts
var b = (e) => new Promise((t) => {
	if (e.modes.getActiveModeId()) return t();
	let n = e.modes.store.subscribe(() => {
		e.modes.getActiveModeId() && (n(), t());
	});
}), x = async (e) => {
	await b(e);
	let t = e.layout.getActivePanel("side"), n = t?.viewId === s.sessionBubble ? t : e.layout.listPanelInstances("side").find((e) => e.viewId === s.sessionBubble);
	n ? e.layout.activatePanel(n.instanceId) : await e.commands.executeCommand(u.createSession, { sidePanel: !0 }), e.sidePanel.setMode("floating");
}, S = {
	type: "session-draft",
	id: "story-preview",
	label: "New session",
	icon: "MessageSquarePlus"
}, C = {
	attachments: [],
	uploading: !1
}, w = {
	getDraft: (e) => e === S.id ? "Keep the restored Side Panel attached after refresh." : "",
	setDraft: () => void 0,
	getAttachmentDraft: () => ({
		getSnapshot: () => C,
		subscribe: () => () => void 0,
		changeAttachments: () => void 0,
		changeUploading: () => void 0
	})
}, T = new t({ defaultOptions: { queries: { retry: !1 } } }), E = {
	title: "Modules/Sessions/Session Chat Draft",
	component: (t) => {
		let { initiallyClosed: n = !1, showMain: r = !1 } = t, [i] = _(() => {
			let e = o({ initialSidePanelMode: n ? "closed" : "attached" });
			return e.registerModule(p()), r ? e.registerModule(g({ sessionDraftPersistence: w })) : e.registerModule(m({ sessionDraftPersistence: w })), l(e, {
				id: "project-story",
				name: "Prompt Studio"
			}), r ? d(e) : f(e), r && e.shell.setRegionOpen("secondary", !1), n || h(e, { resource: S }), e;
		});
		return /* @__PURE__ */ y(e, {
			client: T,
			children: /* @__PURE__ */ y(v, {
				h: "100dvh",
				w: "full",
				children: /* @__PURE__ */ y(c, {
					workbench: i,
					onOpenSidePanel: () => void x(i)
				})
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, D = {}, O = {
	args: { showMain: !0 },
	parameters: { docs: { description: { story: "Main and side chat views share the same bottom inset, with no gap between workspace headers and inputs." } } }
}, k = {
	args: { initiallyClosed: !0 },
	play: async ({ canvasElement: e }) => {
		let t = i(e), o = i(e.ownerDocument.body);
		await n.click(await t.findByRole("button", { name: "Open Side Panel" })), await r(async () => a(await o.findByRole("tab", { name: /New session/ })).toBeVisible()), await n.click(o.getByRole("button", { name: "Close Side Panel" })), await n.click(await t.findByRole("button", { name: "Open Side Panel" })), await a(o.getAllByRole("tab", { name: /New session/ })).toHaveLength(1);
	}
};
export { O as MainAndSidePanels, k as OpenFromBubble, D as PreviewWithRestoredDraft, E as default };
