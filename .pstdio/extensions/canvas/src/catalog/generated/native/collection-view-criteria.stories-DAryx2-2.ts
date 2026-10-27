// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./collection-view-bar-DZiXTxjX.ts";
import { n as a } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { t as o } from "./collection-view-bar-story-C6uj6GIB.ts";
import { Box as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-criteria.stories.tsx
var l = {
	title: "Patterns/Collection View/Filter Row",
	component: i,
	parameters: { layout: "fullscreen" }
}, u = {
	render: () => /* @__PURE__ */ c(s, {
		width: "full",
		maxW: "folder-picker-width",
		children: /* @__PURE__ */ c(o, {
			storageKey: "storybook-many-filter-criteria",
			filter: a,
			editedSorts: [{
				attributeId: "score",
				direction: "desc"
			}]
		})
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = (await a.findByTestId("collection-view-criteria")).querySelector(":scope > [data-scope=\"scroll-area\"][data-part=\"root\"]"), s = o?.querySelector(":scope > [data-part=\"viewport\"]") ?? null;
		r(s).not.toBeNull(), r(s.scrollWidth).toBeGreaterThan(s.clientWidth), await n.hover(s);
		let c = o.querySelector(":scope > [data-part=\"scrollbar\"][data-orientation=\"horizontal\"]");
		await t(() => r(c).toBeVisible()), r(getComputedStyle(c).height).toBe("2px"), r(s.scrollHeight).toBe(s.clientHeight);
		let l = a.getByRole("button", {
			name: "Save view",
			exact: !0
		}), u = a.getByRole("button", {
			name: "Reset",
			exact: !0
		}), d = l.getBoundingClientRect().left, f = u.getBoundingClientRect().left;
		s.scrollLeft = s.scrollWidth, await t(() => r(s.scrollLeft).toBeGreaterThan(0)), r(l.getBoundingClientRect().left).toBe(d), r(u.getBoundingClientRect().left).toBe(f), await r(a.getByRole("group", { name: "Updated filter" })).toBeVisible(), await n.click(a.getByRole("button", {
			name: "Remove Updated filter",
			exact: !0
		})), await r(a.queryByRole("group", { name: "Updated filter" })).not.toBeInTheDocument();
	}
};
export { u as ManyFilters, l as default };
