// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e } from "./collection-view-fields-D15M65ck.ts";
import { n as t } from "./view-filter-rule-editor-DGTvv4jU.ts";
import { r as n, t as r } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { useState as i } from "react";
import { Box as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/view-filter-rule-editor.stories.tsx
var s = {
	title: "Patterns/Collection View/View Filter Rule Editor",
	component: t
}, c = (s) => {
	let [c, l] = i(s.rule), u = e(r, c.attributeId);
	return /* @__PURE__ */ o(a, {
		width: "18.75rem",
		padding: "2xs",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "md",
		bg: "bg",
		children: /* @__PURE__ */ o(t, {
			field: u,
			rule: c,
			options: n(u),
			onChange: l,
			onDelete: () => void 0
		})
	});
}, l = { render: () => /* @__PURE__ */ o(c, { rule: {
	attributeId: "status",
	condition: "is-none-of",
	value: ["done"]
} }) }, u = { render: () => /* @__PURE__ */ o(c, { rule: {
	attributeId: "title",
	condition: "contains",
	value: "chat"
} }) }, d = { render: () => /* @__PURE__ */ o(c, { rule: {
	attributeId: "score",
	condition: "gte",
	value: 70
} }) }, f = { render: () => /* @__PURE__ */ o(c, { rule: {
	attributeId: "updated",
	condition: "is-after",
	value: "2026-10-05"
} }) };
export { f as DateField, d as NumberField, l as OptionField, u as TextField, s as default };
