// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, r as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./resource-search-DheuKFyd.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { jsx as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/resource-search.stories.tsx
var c = i(), l = {
	title: "pstdio-workbench/Components/Resource search",
	component: a,
	decorators: [(e) => /* @__PURE__ */ s(o, { children: /* @__PURE__ */ s(e, {}) })],
	args: {
		workbench: c,
		onClose: t(),
		request: {
			label: "Switch session",
			placeholder: "Search sessions",
			list: () => Array.from({ length: 200 }, (e, t) => ({
				resource: {
					type: "session",
					id: String(t),
					label: `Session ${String(t).padStart(3, "0")}`,
					icon: "MessageCircle"
				},
				activate() {}
			}))
		}
	}
}, u = { play: async ({ canvasElement: t, args: i }) => {
	let a = n(t.ownerDocument.body).getByRole("dialog", { name: "Switch session" }), o = n(a).getByPlaceholderText("Search sessions");
	await e.type(o, "Session 199"), await r(n(a).getByRole("option", { name: "Session 199" })).toBeVisible(), await e.keyboard("{Escape}"), await r(o).toHaveValue(""), await r(i.onClose).not.toHaveBeenCalled(), await e.keyboard("{Escape}"), await r(i.onClose).toHaveBeenCalledOnce();
} }, d = { args: { request: {
	label: "Switch session",
	placeholder: "Search sessions",
	list: () => []
} } }, f = {
	args: { request: {
		label: "Switch session",
		placeholder: "Search sessions",
		list: () => [
			{
				label: "Running",
				icon: "LoaderCircle",
				color: "fg.info"
			},
			{
				label: "Waiting for input",
				icon: "CircleDot",
				color: "fg.warning"
			},
			{
				label: "Queued",
				icon: "ClockAlert",
				color: "fg.info"
			},
			{
				label: "Completed",
				icon: "CircleCheck",
				color: "fg.success"
			},
			{
				label: "Failed",
				icon: "CircleAlert",
				color: "fg.error"
			},
			{
				label: "Cancelled",
				icon: "CircleStop",
				color: "fg.warning"
			},
			{
				label: "Disconnected",
				icon: "CirclePause",
				color: "fg.warning"
			},
			{
				label: "Unknown",
				icon: "CircleDashed",
				color: "fg.muted"
			}
		].map(({ label: e, icon: t, color: n }) => ({
			resource: {
				type: "session",
				id: e,
				label: `${e} session`,
				icon: "MessageCircle"
			},
			indicator: {
				icon: t,
				color: n,
				label: `Session status: ${e}`
			},
			activate() {}
		}))
	} },
	play: async ({ canvasElement: e }) => {
		let t = n(e.ownerDocument.body).getByRole("dialog", { name: "Switch session" });
		await r(n(t).getByRole("img", { name: "Session status: Completed" })).toBeVisible(), await r(n(t).getByRole("img", { name: "Session status: Failed" })).toBeVisible();
	}
}, p = i();
p.resources.registerKind({
	kind: "drawing",
	extensionId: "first",
	label: "First",
	icon: "File"
}), p.resources.registerKind({
	kind: "drawing",
	extensionId: "second",
	label: "Second",
	icon: "Folder"
});
var m = {
	args: {
		workbench: p,
		request: {
			label: "Owner icons",
			placeholder: "Search drawings",
			list: () => [{
				resource: {
					type: "drawing",
					id: "one",
					extensionId: "first",
					label: "First drawing"
				},
				activate() {}
			}, {
				resource: {
					type: "drawing",
					id: "one",
					extensionId: "second",
					label: "Second drawing"
				},
				activate() {}
			}]
		}
	},
	play: async ({ canvasElement: e }) => {
		let t = n(e.ownerDocument.body).getByRole("dialog", { name: "Owner icons" }), i = n(t).getByRole("option", { name: "First drawing" }), a = n(t).getByRole("option", { name: "Second drawing" });
		await r(i.querySelector("svg.lucide-file")).toBeInTheDocument(), await r(a.querySelector("svg.lucide-folder")).toBeInTheDocument();
	}
};
export { d as Empty, u as FullHistory, m as OwnerIcons, f as StatusIndicators, l as default };
