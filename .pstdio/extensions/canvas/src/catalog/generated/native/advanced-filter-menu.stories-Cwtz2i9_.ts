// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./advanced-filter-menu-UCArv6yB.ts";
import { n as i, r as a, t as o } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/advanced-filter-menu.stories.tsx
var u = {
	title: "Patterns/Collection View/Advanced Filter Menu",
	component: r
}, d = (e) => {
	let [t, n] = s(e.filter);
	return /* @__PURE__ */ l(c, {
		width: "40rem",
		padding: "2xs",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "md",
		bg: "bg",
		children: /* @__PURE__ */ l(r, {
			fields: o,
			filter: t,
			optionsFor: a,
			onChange: n
		})
	});
}, f = { render: () => /* @__PURE__ */ l(d, { filter: {
	conjunction: "and",
	rules: [{
		attributeId: "title",
		condition: "contains",
		value: "chat"
	}, {
		attributeId: "score",
		condition: "gte",
		value: 70
	}]
} }) }, p = {
	render: () => /* @__PURE__ */ l(d, { filter: i }),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: "Conjunction" })), await t.click(i.getByRole("menuitem", {
			name: "Or",
			exact: !0
		})), await n(i.getByRole("button", { name: "Conjunction" })).toHaveTextContent("Or"), await t.click(i.getAllByRole("button", { name: "Remove filter" })[0]), await n(i.getAllByTestId("filter-rule-row")).toHaveLength(3);
	}
}, m = { render: () => /* @__PURE__ */ l(d, { filter: {
	conjunction: "or",
	rules: [{
		attributeId: "assignee",
		condition: "is-empty"
	}, {
		attributeId: "labels",
		condition: "is-not-empty"
	}]
} }) };
export { p as AllOrAnyRules, m as EmptyValueConditions, f as SimpleRules, u as default };
