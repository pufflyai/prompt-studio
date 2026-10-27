// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./computer-CIVrE6hN.ts";
import { t as i } from "./plus-CYkLGSPS.ts";
import { t as a } from "./list-row-BhxGCvIh.ts";
import { useState as o } from "react";
import { Box as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/list-row/list-row-hover-content.stories.tsx
var f = {
	title: "Components/Data Display/List Row/Hover Content",
	component: a,
	tags: ["hover-content"]
}, p = () => {
	let [e, t] = o(0), [n, f] = o(0);
	return /* @__PURE__ */ d(c, {
		w: "48",
		gap: "sm",
		children: [
			/* @__PURE__ */ u(a, {
				variant: "tree",
				label: "Workspaces",
				tooltip: "Workspaces",
				icon: /* @__PURE__ */ u(r, {}),
				onActivate: () => f((e) => e + 1),
				actions: [{
					id: "new-workspace",
					label: "New workspace",
					icon: /* @__PURE__ */ u(i, {}),
					onAction: () => t((e) => e + 1)
				}]
			}),
			/* @__PURE__ */ u(a, {
				variant: "tree",
				label: "Workspaces",
				icon: /* @__PURE__ */ u(r, {}),
				actions: [{
					id: "new-workspace",
					label: "New workspace",
					icon: /* @__PURE__ */ u(i, {})
				}]
			}),
			/* @__PURE__ */ u(a, {
				variant: "tree",
				label: "Workspaces",
				icon: /* @__PURE__ */ u(r, {}),
				endContent: /* @__PURE__ */ u(l, {
					textStyle: "label/XS",
					children: "12"
				})
			}),
			/* @__PURE__ */ u(s, {
				color: "fg.muted",
				textStyle: "label/XS",
				children: "Hover or focus a row. Hidden actions release label space; the count stays visible."
			}),
			/* @__PURE__ */ u(l, {
				role: "status",
				"aria-label": "Action activations",
				textStyle: "label/XS",
				children: e
			}),
			/* @__PURE__ */ u(l, {
				role: "status",
				"aria-label": "Row activations",
				textStyle: "label/XS",
				children: n
			})
		]
	});
}, m = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getAllByRole("option", {
			name: "Workspaces",
			exact: !0
		})[0];
		await t.click(a), await t.tab(), await t.keyboard("{Enter}"), await n(i.getByRole("status", { name: "Action activations" })).toHaveTextContent("1"), await t.keyboard(" "), await n(i.getByRole("status", { name: "Action activations" })).toHaveTextContent("2"), await n(i.getByRole("status", { name: "Row activations" })).toHaveTextContent("1"), a.focus(), await t.keyboard("{Enter}"), await n(i.getByRole("status", { name: "Row activations" })).toHaveTextContent("2");
	}
};
export { m as NarrowNavigation, f as default };
