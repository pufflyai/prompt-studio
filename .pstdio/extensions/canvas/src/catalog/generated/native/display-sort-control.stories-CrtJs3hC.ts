// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./display-sort-control-DHtzd27a.ts";
import { useState as i } from "react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/display-sort-control.stories.tsx
var o = {
	title: "Patterns/Collection View/Display Sort Control",
	component: r
}, s = () => {
	let [e, t] = i([]);
	return /* @__PURE__ */ a(r, {
		fields: [{
			id: "none",
			label: "No estimate",
			type: { kind: "number" },
			sortable: !0
		}],
		sorts: e,
		onSortsChange: t
	});
}, c = {
	render: () => /* @__PURE__ */ a(s, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body);
		await t.click(i.getByRole("button", { name: "Ordering" })), await t.click(a.getByRole("menuitem", { name: "No estimate" })), await n(i.getByRole("button", { name: "Ordering" })).toHaveTextContent("No estimate"), await n(i.getByRole("button", { name: "Sort direction" })).toHaveTextContent("1 → 9"), await t.click(i.getByRole("button", { name: "Ordering" })), await n(a.getByRole("menuitem", { name: "No estimate" }).querySelector(".lucide-check")).toBeInTheDocument(), await t.click(a.getByRole("menuitem", {
			name: "None",
			exact: !0
		})), await n(i.queryByRole("button", { name: "Sort direction" })).not.toBeInTheDocument();
	}
};
export { c as NamedNone, o as default };
