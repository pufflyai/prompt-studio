// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e, t } from "./test-CYwQ_LKY.ts";
import { t as n } from "./workbench-story-B6F8bQqu.ts";
import { t as r } from "./panel-policy.fixture-D8ijqHtt.ts";
// packages/pstdio-workbench/src/react/region/panel-policy.stories.tsx
var i = {
	title: "pstdio-workbench/Reference/Core API/Panel policy",
	component: n,
	parameters: { layout: "fullscreen" }
}, a = {
	args: { workbench: r() },
	play: async ({ canvasElement: n }) => {
		let r = e(n), i = n.querySelector("[data-workbench-region=\"nav\"]"), a = n.querySelector("[data-workbench-region=\"status\"]");
		await t(e(i).getByRole("button", { name: "Hide Side Panel" })).toBeVisible(), await t(e(i).getByRole("button", { name: "Hide Bottom Panel" })).toBeVisible(), await t(e(a).queryByRole("group", { name: "Panel controls" })).toBeNull(), await t(r.getByText("Mode status content")).toBeVisible();
	}
}, o = { args: { workbench: r({ showHeader: !1 }) } }, s = {
	args: { workbench: r({
		canOpen: !0,
		canClose: !1,
		acceptsTabs: !1,
		resizable: !1,
		floatable: !1
	}) },
	play: async ({ canvasElement: n, args: r }) => {
		let i = e(n);
		await t(await i.findByText("Session content")).toBeVisible(), await t(i.queryByRole("button", { name: "Hide Side Panel" })).toBeNull(), await t(i.queryByRole("button", { name: "Hide Bottom Panel" })).toBeNull(), await t(i.queryByRole("button", { name: "Float Side Panel" })).toBeNull(), await t(i.queryByRole("separator", { name: "Resize Side Panel" })).toBeNull(), t(() => r.workbench.shell.setRegionOpen("side", !1)).toThrow("cannot close");
	}
}, c = { args: { workbench: r({ showHeader: !1 }, !0) } }, l = { args: { workbench: (() => {
	let e = r();
	return e.shell.setSidePanelPresentation("floating"), e;
})() } };
export { l as FloatingHeader, o as HiddenHeaders, c as LegacyHeaders, s as RestrictedPanels, a as SharedControls, i as default };
