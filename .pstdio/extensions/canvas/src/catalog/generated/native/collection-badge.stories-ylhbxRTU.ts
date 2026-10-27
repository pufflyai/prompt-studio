// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { o as e, u as t } from "./kanban-renderer-helpers-CvTscXNQ.ts";
import { useState as n } from "react";
import { Box as r, Stack as i, Text as a, Wrap as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/collection-badge.stories.tsx
var l = {
	id: "contributors",
	label: "Contributors",
	type: { kind: "string" },
	display: {
		kind: "badge-list",
		itemsAttributeId: "contributorItems"
	}
}, u = {
	id: "recipe-1",
	title: "Soup",
	attributes: {
		contributors: "ada",
		contributorItems: [{
			id: "ada",
			label: "Ada",
			icon: "user",
			resource: {
				type: "person",
				id: "ada"
			}
		}, {
			id: "lee",
			label: "Lee",
			icon: "user",
			resource: {
				type: "person",
				id: "lee"
			}
		}]
	}
}, d = () => {
	let [t, d] = n("None"), f = e(l, u.attributes.contributors, u, (e) => d(e.id));
	return /* @__PURE__ */ c(i, {
		p: "lg",
		gap: "md",
		children: [/* @__PURE__ */ s(o, {
			gap: "2xs",
			children: f
		}), /* @__PURE__ */ c(r, { children: [/* @__PURE__ */ s(a, {
			textStyle: "label/S/medium",
			children: "Opened resource"
		}), /* @__PURE__ */ s(a, {
			"data-testid": "opened-resource",
			children: t
		})] })]
	});
}, f = {
	title: "Patterns/Kanban Renderer/Collection badge list",
	parameters: { layout: "fullscreen" }
}, p = { render: () => /* @__PURE__ */ s(d, {}) }, m = { render: () => /* @__PURE__ */ c(o, {
	p: "lg",
	gap: "sm",
	children: [
		/* @__PURE__ */ s(t, {
			label: "1",
			icon: "message-circle-warning",
			color: "orange",
			tooltip: "1 open review request",
			onClick: () => {}
		}),
		/* @__PURE__ */ s(t, {
			label: "3",
			icon: "message-circle-warning",
			color: "orange",
			tooltip: "3 open review requests",
			onClick: () => {}
		}),
		/* @__PURE__ */ s(t, {
			label: "3",
			icon: "message-circle-warning",
			color: "green",
			tooltip: "All 3 review requests resolved",
			onClick: () => {}
		})
	]
}) };
export { p as LinkedResources, m as ReviewRequestCounts, f as default };
