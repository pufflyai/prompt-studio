// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./param-editor-387PxPNF.ts";
import { t as r } from "./param-editor-horizontal-CEr38QkA.ts";
import { useState as i } from "react";
import { Box as a, Container as o, Stack as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-multiline.stories.tsx
var u = [{
	id: "title",
	name: "Title",
	type: "text",
	defaultValue: "Workspace summary"
}, {
	id: "instructions",
	name: "Instructions",
	type: "text",
	singleLine: !1,
	defaultValue: "Summarize the selected changes.\nInclude the next steps."
}], d = {
	title: "Patterns/Param Editor/Multiline Text",
	component: (e) => {
		let { readOnly: t, grouped: d, variant: f } = e, [p, m] = i({}), h = {
			...d ? { groups: [{
				id: "content",
				title: "Content",
				params: u
			}] } : { params: u },
			readOnly: t,
			variant: f,
			defaultValues: p,
			onChange: (e, t) => m((n) => ({
				...n,
				[e]: t
			}))
		};
		return /* @__PURE__ */ c(o, {
			padding: "md",
			maxWidth: "none",
			children: /* @__PURE__ */ l(s, {
				gap: "md",
				maxWidth: "360px",
				children: [/* @__PURE__ */ c(a, {
					"data-testid": "vertical-editor",
					children: /* @__PURE__ */ c(n, { ...h })
				}), /* @__PURE__ */ c(a, {
					"data-testid": "horizontal-editor",
					children: /* @__PURE__ */ c(r, { ...h })
				})]
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, f = { play: async ({ canvasElement: n }) => {
	let r = e(n);
	for (let n of ["vertical", "horizontal"]) {
		let i = r.getByTestId(`${n}-editor`), a = e(i).getByRole("textbox", { name: "Instructions" }), o = e(i).getByText("Instructions");
		await t(a.tagName).toBe("TEXTAREA"), await t(o.getBoundingClientRect().bottom).toBeLessThanOrEqual(a.getBoundingClientRect().top);
		let s = n === "vertical" ? 24 : 0;
		await t(a.getBoundingClientRect().width).toBe(i.getBoundingClientRect().width - s);
	}
} }, p = {
	...f,
	args: { grouped: !0 }
}, m = {
	...f,
	args: {
		grouped: !0,
		variant: "small"
	}
}, h = {
	args: {
		grouped: !0,
		readOnly: !0
	},
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		for (let n of ["vertical", "horizontal"]) {
			let i = r.getByTestId(`${n}-editor`), a = e(i).getByText("Instructions"), o = e(i).getByText(/Summarize the selected changes/);
			await t(a.getBoundingClientRect().bottom).toBeLessThanOrEqual(o.getBoundingClientRect().top), await t(o).toHaveStyle({ whiteSpace: "pre-wrap" });
		}
	}
};
export { f as Editable, p as Grouped, h as ReadOnly, m as Small, d as default };
