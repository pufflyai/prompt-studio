// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { _ as r, t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./command-palette-B0epHLs8.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { Box as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
var l = {
	title: "pstdio-workbench/Reference/Command palette/Assigned shortcuts",
	component: a,
	tags: ["palette-shortcuts"],
	args: {
		workbench: (() => {
			let e = i();
			for (let [t, n, i, a] of [
				[
					"workspaces.open",
					"Open workspaces",
					"Dashboard",
					"Alt+Shift+W"
				],
				[
					"tickets.open",
					"Open tickets",
					"Planner",
					"Alt+Shift+P"
				],
				[
					"notes.create",
					"New note",
					"Notes",
					"Mod+Alt+N"
				]
			]) {
				e.commands.registerCommand({
					id: t,
					label: n,
					category: i
				}, { execute: () => void 0 }), e.keybindings.registerKeybinding({
					action: {
						kind: "command",
						commandId: t
					},
					keybinding: a
				});
				let o = `${t}.palette`;
				e.commands.registerCommand({
					id: o,
					label: n,
					category: i
				}, { execute: () => void 0 }), e.layout.registerMenuItem(r, {
					commandId: o,
					sourceCommandId: t
				});
			}
			return e;
		})(),
		open: !0,
		initialQuery: ">",
		onClose: () => void 0
	},
	render: (e) => /* @__PURE__ */ c(o, { children: /* @__PURE__ */ c(s, {
		position: "relative",
		h: "600px",
		children: /* @__PURE__ */ c(a, { ...e })
	}) })
}, u = { play: async ({ args: r }) => {
	let i = t(document.body), a = await i.findByPlaceholderText("Run command");
	for (let [r, o] of [
		["Open workspaces", "W"],
		["Open tickets", "P"],
		["New note", "N"]
	]) {
		await e.clear(a), await e.type(a, `>${r}`);
		let s = await i.findByRole("option", { name: new RegExp(r) });
		await n(t(s).getByText(o, { exact: !0 })).toBeVisible();
	}
	let o = r.workbench.keybindings.registerKeybinding({
		action: {
			kind: "command",
			commandId: "notes.create"
		},
		keybinding: "Mod+Alt+M"
	});
	try {
		await n(await i.findByText("M", { exact: !0 })).toBeVisible();
	} finally {
		o.dispose();
	}
	await n(await i.findByText("N", { exact: !0 })).toBeVisible();
} };
export { u as AssignedShortcuts, l as default };
