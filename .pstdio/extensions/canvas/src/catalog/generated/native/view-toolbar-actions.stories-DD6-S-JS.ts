// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./view-toolbar-actions-DhZCBk2x.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { Button as s, HStack as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/view-toolbar-actions.stories.tsx
var p = [{
	id: "run",
	label: "Run experiment",
	presentation: "primary"
}, {
	id: "refresh",
	label: "Refresh results"
}], m = {
	title: "pstdio-workbench/Reference/Core API/Native toolbar actions",
	component: (e) => {
		let { actions: t } = e, [n] = o(() => r()), [a, p] = o("None");
		return /* @__PURE__ */ f(l, {
			p: "sm",
			children: [/* @__PURE__ */ f(c, {
				gap: "2xs",
				children: [
					/* @__PURE__ */ d(s, {
						size: "2xs",
						variant: "ghost",
						children: "Filter"
					}),
					/* @__PURE__ */ d(s, {
						size: "2xs",
						variant: "ghost",
						children: "Display"
					}),
					/* @__PURE__ */ d(i, {
						workbench: n,
						actions: t.map((e) => ({
							...e,
							run: () => p(e.label ?? e.id)
						}))
					})
				]
			}), /* @__PURE__ */ f(u, { children: ["Last action: ", a] })]
		});
	},
	args: { actions: p },
	decorators: [(e) => /* @__PURE__ */ d(a, { children: /* @__PURE__ */ d(e, {}) })]
}, h = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = i.getByRole("button", { name: "Run experiment" });
	await n(a.getBoundingClientRect().height).toBe(28), await n(i.getByRole("button", { name: "Refresh results" }).getBoundingClientRect().height).toBe(28), await n(i.getAllByRole("separator")).toHaveLength(1), await n(i.getByRole("separator").getBoundingClientRect().height).toBe(24), await e.click(a), await n(i.getByText("Last action: Run experiment")).toBeVisible();
} }, g = {
	args: { actions: [] },
	play: async ({ canvasElement: e }) => {
		await n(t(e).queryByRole("separator")).not.toBeInTheDocument();
	}
}, _ = {
	args: { actions: p.map((e) => ({
		...e,
		when: "false"
	})) },
	play: async ({ canvasElement: e }) => {
		let r = t(e);
		await n(r.queryByRole("button", { name: "Run experiment" })).not.toBeInTheDocument(), await n(r.queryByRole("separator")).not.toBeInTheDocument();
	}
};
export { _ as HiddenActions, g as NoActions, h as VisibleActions, m as default };
