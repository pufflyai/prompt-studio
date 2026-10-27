// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./archive-DozS7A-I.ts";
import { t as o } from "./list-row-BhxGCvIh.ts";
import { useState as s } from "react";
import { Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/list-row/list-row-action-menu.stories.tsx
var f = {
	title: "Components/Data Display/List Row/Action Menus",
	component: o
}, p = (e) => {
	let { searchable: t } = e, [n, r] = s(0);
	return /* @__PURE__ */ d(c, {
		w: "80",
		children: [/* @__PURE__ */ u(o, {
			id: "ticket",
			label: "Release notes",
			showContextMenuTrigger: !0,
			actions: [{
				id: "archive",
				label: "Archive",
				icon: /* @__PURE__ */ u(a, {}),
				disabled: !0,
				onAction: () => r(n + 1)
			}],
			contextMenuItems: Array.from({ length: t ? 7 : 1 }, (e, t) => ({
				id: `action-${t}`,
				label: `Action ${t + 1}`
			}))
		}), /* @__PURE__ */ d(l, {
			role: "status",
			textStyle: "label/XS",
			children: ["Invoked: ", n]
		})]
	});
}, m = async ({ canvasElement: a }) => {
	let o = e(a), s = e(a.ownerDocument.body);
	await r.click(o.getByRole("button", { name: "Resource actions" }));
	let c = await s.findByRole("menuitem", {
		name: "Archive",
		exact: !0
	});
	await i(c).toHaveAttribute("aria-disabled", "true"), t.click(c), await n(() => i(o.getByRole("status")).toHaveTextContent("Invoked: 0"));
}, h = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: m
}, g = {
	render: () => /* @__PURE__ */ u(p, { searchable: !0 }),
	play: m
};
export { h as DisabledResourceAction, g as DisabledSearchableAction, f as default };
