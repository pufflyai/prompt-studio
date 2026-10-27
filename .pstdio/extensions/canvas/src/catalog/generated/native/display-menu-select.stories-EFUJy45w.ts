// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { n as r } from "./display-menu-DgqSpRfh.ts";
import { useState as i } from "react";
import { Box as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/display-menu-select.stories.tsx
var l = () => {
	let [e, t] = i("none");
	return /* @__PURE__ */ c(a, {
		width: "18rem",
		children: [/* @__PURE__ */ s(r, {
			label: "Grouping",
			value: e,
			onSelect: t,
			options: [{
				value: "none",
				label: "None"
			}, ...Array.from({ length: 30 }, (e, t) => ({
				value: String(t),
				label: `Property ${t + 1}`
			}))]
		}), /* @__PURE__ */ s(o, {
			"data-testid": "grouping",
			children: e
		})]
	});
}, u = { title: "Patterns/Collection View/Display Select" }, d = {
	render: () => /* @__PURE__ */ s(l, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r.ownerDocument.body);
		await t.click(i.getByRole("button", { name: /Grouping/ }));
		let a = i.getByRole("menu"), o = a.querySelector("[data-part=\"viewport\"]");
		n(o).not.toBeNull(), n(o.scrollHeight).toBeGreaterThan(o.clientHeight), n(getComputedStyle(a.querySelector("[data-part=\"scrollbar\"]")).width).toBe("2px"), o.scrollTop = o.scrollHeight, await t.click(i.getByRole("menuitem", {
			name: "Property 30",
			exact: !0
		})), await n(i.getByTestId("grouping")).toHaveTextContent("29");
	}
};
export { d as LongOptions, u as default };
