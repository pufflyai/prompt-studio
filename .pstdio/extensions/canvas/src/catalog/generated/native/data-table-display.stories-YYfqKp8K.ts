// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./data-table-BI2_ziSb.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-display.stories.tsx
var o = Array.from({ length: 24 }, (e, t) => ({
	Name: `Item ${t + 1}`,
	Amount: t + 1
})), s = {
	title: "Components/Data Display/Data Table Display",
	component: r,
	decorators: [(e) => /* @__PURE__ */ a(i, {
		height: "96",
		padding: "sm",
		children: /* @__PURE__ */ a(e, {})
	})],
	args: {
		data: o,
		initialPageSize: 10
	}
}, c = {
	args: {
		toolbarStorageKey: "storybook-enable-table-statistics",
		defaultSettings: { showStats: !1 },
		columnStats: { Amount: {
			type: "histogram",
			bins: 4
		} }
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body);
		await t.click(i.getByRole("button", { name: "Display settings" }));
		let o = e(await a.findByRole("dialog"));
		await t.click(o.getByText("Statistics", { exact: !0 })), await n(o.getByRole("switch", { name: /^Statistics/ })).toBeChecked(), await n(await i.findByLabelText("Distribution for Amount")).toBeVisible(), await t.keyboard("{Escape}"), await t.click(i.getByRole("button", { name: "Go to next page" })), await n(i.getByRole("cell", {
			name: "Item 11",
			exact: !0
		})).toBeVisible(), await n(i.getByLabelText("Distribution for Amount")).toBeVisible();
	}
}, l = {
	args: {
		toolbarStorageKey: "storybook-filtered-table-pagination",
		defaultFilter: {
			conjunction: "and",
			rules: [{
				attributeId: "Amount",
				condition: "gt",
				value: 3
			}]
		}
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(i.getByRole("cell", {
			name: "Item 4",
			exact: !0
		})).toBeVisible(), await t.click(i.getByRole("button", { name: "Go to next page" })), await n(i.getByRole("cell", {
			name: "Item 14",
			exact: !0
		})).toBeVisible(), await t.click(i.getByRole("button", { name: "Go to last page" })), await n(i.getByRole("cell", {
			name: "Item 24",
			exact: !0
		})).toBeVisible();
	}
};
export { c as EnableStatistics, l as FilteredPagination, s as default };
