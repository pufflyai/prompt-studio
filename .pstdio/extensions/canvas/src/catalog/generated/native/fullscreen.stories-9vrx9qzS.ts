// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { t as a } from "./fullscreen.fixture-B9vrzI0p.ts";
// packages/pstdio-workbench/src/react/workbench/fullscreen.stories.tsx
var o = {
	title: "pstdio-workbench/Reference/Core API/Main fullscreen",
	component: i,
	parameters: { layout: "fullscreen" },
	tags: ["main-fullscreen"]
}, s = a();
s.w.modes.registerMode({
	id: "restricted",
	canFullscreen: !1,
	activate() {}
});
var c = {
	args: { workbench: s.w },
	play: async ({ canvasElement: e }) => {
		let i = n(e);
		await r(i.getByRole("button", { name: "Enter Main fullscreen" })).toBeVisible(), s.w.modes.setActiveMode("restricted"), await t(() => r(i.queryByRole("button", { name: "Enter Main fullscreen" })).toBeNull()), s.w.modes.setActiveMode("first"), await r(await i.findByRole("button", { name: "Enter Main fullscreen" })).toBeVisible();
	}
}, l = (i, o = !0, s = !1) => {
	let { w: c, lifecycle: l } = a(i, o, { hiddenNav: s });
	return {
		args: { workbench: c },
		play: async ({ canvasElement: a }) => {
			let s = n(a), u = n(a.ownerDocument.body), d = await s.findByRole("textbox", { name: "Editor draft" });
			await e.type(d, "Unsaved Main draft");
			let f = structuredClone(c.host.getSnapshot()), p = l.mounts, m = l.unmounts;
			if (i !== "closed") {
				let e = u.getByLabelText("Side panel header");
				i === "floating" ? r(e).not.toHaveAttribute("data-panel-draggable") : r(e).toHaveAttribute("data-panel-draggable");
			}
			if (await e.click(s.getByRole("button", { name: "Enter Main fullscreen" })), await r(s.getByRole("button", { name: "Exit Main fullscreen" })).toBeVisible(), await r(d).toBeVisible(), r(l.mounts).toBe(p), r(l.unmounts).toBe(m), r(c.host.getSnapshot()).toEqual(f), o) {
				i === "closed" && await e.click(u.getByRole("button", { name: "Open Side Panel" })), await t(() => r(u.getByRole("dialog", { name: "Side Panel" })).toBeVisible()), r(u.getAllByLabelText("Side panel header")).toHaveLength(1), r(u.getByLabelText("Side panel header")).not.toHaveAttribute("data-panel-draggable"), r(u.queryByRole("button", { name: "Open Side Panel" })).toBeNull(), await e.click(u.getByRole("button", { name: "Close Side Panel" })), await t(() => r(u.getByRole("button", { name: "Open Side Panel" })).toHaveFocus()), r(u.queryAllByLabelText("Side panel header")).toHaveLength(0);
				let n = await u.findByRole("button", { name: "Open Side Panel" });
				await t(() => r(n).toBeVisible()), await e.click(n), await t(() => r(u.getByRole("dialog", { name: "Side Panel" })).toBeVisible()), r(c.host.getSnapshot()).toEqual(f), await e.click(u.getByRole("button", { name: "Close Side Panel" })), await t(() => r(u.getByRole("button", { name: "Open Side Panel" })).toBeVisible());
			} else r(u.queryByRole("button", { name: "Open Side Panel" })).toBeNull();
			await e.click(s.getByRole("button", { name: "Exit Main fullscreen" })), await r(s.getByRole("button", { name: "Enter Main fullscreen" })).toHaveFocus(), await r(d).toHaveValue("Unsaved Main draft"), r(c.host.getSnapshot()).toEqual(f), r(l.mounts).toBe(p), r(l.unmounts).toBe(m), i === "attached" && r(u.getByLabelText("Side panel header")).toHaveAttribute("data-panel-draggable");
		}
	};
}, u = l("attached"), d = l("floating"), f = l("closed"), p = l("attached", !1), m = l("attached", !0, !0), h = l("attached");
h.args.workbench.shell.repositionPanel("side", "left"), h.args.workbench.shell.repositionPanel("secondary", "top");
var g = a(), _ = {
	args: { workbench: g.w },
	play: async ({ canvasElement: i }) => {
		let { w: a, lifecycle: o } = g, s = n(i), c = await s.findByRole("textbox", { name: "Editor draft" }), l = o.unmounts;
		await e.type(c, "First page draft"), await e.type(s.getByRole("textbox", { name: "Session draft" }), "Shared session draft"), await e.type(s.getByRole("textbox", { name: "Terminal draft" }), "Running terminal draft");
		let u = (e) => a.pageLocations.navigate({
			kind: "page",
			page: {
				kind: "page",
				extensionId: "fullscreen",
				id: e
			}
		});
		await e.click(s.getByRole("button", { name: "Enter Main fullscreen" })), u("second"), await t(() => r(s.getByRole("textbox", { name: "Editor draft" })).toHaveValue("")), r(a.fullscreen.store.getState().active).toBe(!0), u("other"), await t(() => r(s.getByRole("button", { name: "Enter Main fullscreen" })).toBeVisible()), u("first"), await t(() => r(s.getByRole("textbox", { name: "Editor draft" })).toHaveValue("First page draft")), await r(s.getByRole("textbox", { name: "Session draft" })).toHaveValue("Shared session draft"), await r(s.getByRole("textbox", { name: "Terminal draft" })).toHaveValue("Running terminal draft"), r(o.unmounts).toBe(l);
	}
};
export { u as AttachedSide, f as ClosedSide, p as FixedSide, d as FloatingSide, m as HiddenNavigation, c as ModePolicy, _ as PageAndModeContinuity, h as RearrangedPanels, o as default };
