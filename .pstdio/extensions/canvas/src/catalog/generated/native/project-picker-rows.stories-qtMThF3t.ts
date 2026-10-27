// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./test-CYwQ_LKY.ts";
import { t } from "./resource-icons-CZFS6OM4.ts";
import { t as n } from "./resources-CR_Z7fRd.ts";
import { t as r } from "./project-picker-widget-BdXrd_av.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/components/project-picker-rows.stories.tsx
var o = (e, r, i) => ({
	id: e,
	name: r,
	folderPath: i,
	createdAt: "",
	updatedAt: "",
	resource: n("project", e, r, t.project, e)
}), s = [
	o("prompt-studio", "Prompt Studio", null),
	o("granite", "Granite", null),
	o("docufin", "Docufin", "~/Projects/docufin"),
	o("scratchpad", "Scratchpad", "~/Documents/scratchpad")
], c = {
	title: "Projects/Project picker rows",
	component: r,
	decorators: [(e) => /* @__PURE__ */ a(i, {
		w: "md",
		children: /* @__PURE__ */ a(e, {})
	})],
	args: {
		projects: s,
		selectedProjectId: "prompt-studio",
		searchTerm: "",
		onSelectProject: e(),
		cloudState: () => ({
			signedIn: !1,
			cloud: !1
		})
	}
}, l = { args: { cloudState: (e) => e === "scratchpad" ? {
	signedIn: !0,
	cloud: !1
} : {
	signedIn: !0,
	cloud: !0,
	sync: {
		state: "first-download-incomplete",
		offlineReady: !1
	}
} } }, u = { args: { cloudState: (e) => e === "scratchpad" ? {
	signedIn: !0,
	cloud: !1
} : {
	signedIn: !0,
	cloud: !0,
	sync: {
		state: "waiting-to-sync",
		offlineReady: !1
	}
} } }, d = { args: { cloudState: (e) => e === "scratchpad" ? {
	signedIn: !0,
	cloud: !1
} : {
	signedIn: !0,
	cloud: !0,
	sync: {
		state: "synced",
		offlineReady: !0
	}
} } }, f = { args: { cloudState: (e) => e === "scratchpad" ? {
	signedIn: !0,
	cloud: !1
} : {
	signedIn: !0,
	cloud: !0,
	sync: {
		state: "needs-attention",
		offlineReady: !1
	}
} } }, p = {};
export { f as NeedsAttention, l as NotOnThisDeviceYet, d as ReadyWithoutFolder, p as SignedOut, u as WaitingToDownload, c as default };
