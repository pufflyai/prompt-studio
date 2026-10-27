// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import "./workbench-extension-contributions-C_CIJIkp.ts";
import "react";
import { Dialog as e, Flex as t, Menu as n, Stack as r, Text as i } from "@chakra-ui/react";
import { ListRow as a, PaletteShortcut as o, ScrollArea as s } from "@pstdio/ui";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
import "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/modules/keyboard-shortcuts/components/keyboard-shortcuts-widget.tsx
var u = (e) => {
	let { shortcut: n } = e;
	return /* @__PURE__ */ c(t, {
		gap: "xs",
		align: "center",
		flexWrap: "wrap",
		children: n.keybindings.map((e) => /* @__PURE__ */ c(o, { binding: e }, JSON.stringify(e)))
	});
}, d = {
	title: "Help/Keyboard shortcuts",
	component: (t) => {
		let { shortcuts: o } = t, d = [...new Set(o.map((e) => e.category))];
		return /* @__PURE__ */ l(r, {
			gap: "0",
			minW: "0",
			children: [/* @__PURE__ */ c(e.Header, {
				pr: "10",
				children: /* @__PURE__ */ c(i, {
					textStyle: "heading/S",
					children: "Keyboard shortcuts"
				})
			}), /* @__PURE__ */ c(e.Body, { children: /* @__PURE__ */ c(s, {
				maxH: "24rem",
				showHorizontalScrollbar: !1,
				contentProps: { pr: "2xs" },
				children: /* @__PURE__ */ c(n.Root, {
					open: !0,
					closeOnSelect: !1,
					children: /* @__PURE__ */ c(n.Content, {
						position: "static",
						minW: "full",
						maxW: "full",
						bg: "transparent",
						borderWidth: "0",
						children: d.map((e) => /* @__PURE__ */ l(n.ItemGroup, { children: [/* @__PURE__ */ c(n.ItemGroupLabel, { children: e }), o.filter((t) => t.category === e).map((e) => /* @__PURE__ */ c(n.Item, {
							value: e.id,
							asChild: !0,
							children: /* @__PURE__ */ c(a, {
								variant: "full-width",
								label: e.label,
								tooltip: e.label,
								description: e.keybindings.length > 1 ? /* @__PURE__ */ c(u, { shortcut: e }) : void 0,
								endContent: e.keybindings.length <= 1 ? /* @__PURE__ */ c(u, { shortcut: e }) : void 0
							})
						}, e.id))] }, e))
					})
				})
			}) })]
		});
	},
	decorators: [(t) => /* @__PURE__ */ c(e.Root, {
		open: !0,
		children: /* @__PURE__ */ c(e.Positioner, { children: /* @__PURE__ */ c(e.Content, { children: /* @__PURE__ */ c(t, {}) }) })
	})]
}, f = { args: { shortcuts: [
	{
		id: "palette",
		label: "Toggle Command Palette",
		category: "Workbench",
		keybindings: ["Mod+P"]
	},
	{
		id: "document",
		label: "Open a document with a very long name in the project workspace",
		category: "Notes",
		keybindings: [
			["Mod+K", "Mod+O"],
			["Mod+K", "Mod+N"],
			["Mod+K", "Mod+D"],
			"Alt+O"
		]
	},
	{
		id: "note",
		label: "New note",
		category: "Notes",
		keybindings: ["Alt+Shift+C"]
	},
	{
		id: "link",
		label: "https://example.com/documentation",
		category: "Notes",
		keybindings: ["Mod+Shift+H"]
	},
	{
		id: "panel",
		label: "Notes + Inspector",
		category: "Notes",
		keybindings: ["Alt+Shift+N"]
	}
] } };
export { f as AssignedShortcuts, d as default };
