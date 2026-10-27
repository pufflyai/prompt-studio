// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./list-row-BhxGCvIh.ts";
import { t as r } from "./search-modal-content-CrWUdr-6.ts";
import { useState as i } from "react";
import { Button as a, Dialog as o, Stack as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
var u = {
	title: "Overlays/Search modal content",
	component: (e) => {
		let { showSearch: t } = e, [u, d] = i("");
		return /* @__PURE__ */ l(o.Root, {
			open: !0,
			placement: "center",
			children: [/* @__PURE__ */ c(o.Backdrop, {}), /* @__PURE__ */ c(o.Positioner, { children: /* @__PURE__ */ c(o.Content, { children: /* @__PURE__ */ c(r, {
				title: "Projects",
				showSearch: t,
				searchValue: u,
				searchPlaceholder: "Search projects",
				searchAutoFocus: !0,
				showCloseButton: !0,
				footerEnd: /* @__PURE__ */ c(a, {
					variant: "outline",
					size: "xs",
					children: "Create project"
				}),
				onSearchChange: d,
				children: /* @__PURE__ */ c(s, {
					gap: "0",
					children: [
						"Prompt Studio",
						"Design tools",
						"Team notes"
					].filter((e) => !t || e.toLowerCase().includes(u.toLowerCase())).map((e) => /* @__PURE__ */ c(n, {
						id: e,
						label: e,
						variant: "full-width"
					}, e))
				})
			}) }) })]
		});
	},
	parameters: { layout: "fullscreen" },
	args: { showSearch: !0 }
}, d = {}, f = {
	args: { showSearch: !1 },
	play: async ({ canvasElement: n }) => {
		let r = e(n).getByRole("dialog");
		await t(e(r).queryByRole("textbox")).not.toBeInTheDocument(), await t(e(r).getByRole("heading", { name: "Projects" })).toBeVisible();
	}
};
export { d as Searchable, f as WithoutSearch, u as default };
