// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./collection-view-bar-story-Djy9rHNd.ts";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/advanced-filter.stories.tsx
var s = {
	title: "Patterns/Collection View/Advanced Filter",
	parameters: { layout: "fullscreen" }
}, c = {
	render: () => /* @__PURE__ */ o(a, {
		storageKey: "storybook-advanced-date-parameters",
		filter: {
			conjunction: "and",
			rules: [],
			groups: [{
				conjunction: "and",
				rules: [{
					attributeId: "updated",
					condition: "is",
					value: "2026-10-04"
				}]
			}]
		}
	}),
	play: async ({ canvasElement: n }) => {
		let a = e(n), o = e(n.ownerDocument.body);
		await r.click(a.getByRole("button", { name: "Edit advanced filter" }));
		let s = await o.findByTestId("advanced-filter-popover");
		await r.click(e(s).getByRole("button", { name: "Values" }));
		let c = e(s).getByLabelText("Value");
		await i(c).toHaveValue("2026-10-04"), await r.click(c), t.change(c, { target: { value: "2026-10-05" } }), await i(s).toBeVisible(), await i(c).toHaveValue("2026-10-05");
	}
}, l = {
	render: () => /* @__PURE__ */ o(a, {
		storageKey: "storybook-normal-advanced",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "archived",
				condition: "is",
				value: !1
			}, {
				attributeId: "priority",
				condition: "is-any-of",
				value: ["high", "medium"]
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = e(t.ownerDocument.body), s = a.getByRole("group", { name: "Archived filter" }), c = e(s).getByText("Ticket", { exact: !0 }), l = e(s).getByText("Archived", { exact: !0 });
		i(getComputedStyle(l).fontSize).toBe(getComputedStyle(c).fontSize), i(e(a.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" })).toHaveTextContent("is any of"), await r.click(a.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let u = await o.findByTestId("filter-menu");
		await n(() => i(e(u).getByRole("textbox", { name: "Filter properties" })).toBeVisible()), await r.click(e(e(u).getByTestId("filter-menu-footer")).getByRole("button", {
			name: "Advanced filter",
			exact: !0
		}));
		let d = await o.findByTestId("advanced-filter-popover");
		await r.click(e(d).getByRole("button", { name: "Add filter rule" })), await r.click(e(d).getByRole("button", { name: "Add filter rule" })), await r.click(e(d).getByRole("button", { name: "Conjunction" })), await r.click(o.getByRole("menuitem", {
			name: "Or",
			exact: !0
		})), await i(e(d).getByRole("button", { name: "Conjunction" })).toHaveTextContent("Or"), await r.click(e(d).getAllByRole("button", {
			name: "Field",
			exact: !0
		})[0]), await r.click(o.getByRole("menuitem", {
			name: "Status",
			exact: !0
		})), await r.click(e(d).getByRole("button", { name: "Values" })), await r.click(o.getByRole("menuitemcheckbox", { name: /Todo/ }));
		let f = o.getByRole("menuitemcheckbox", { name: /Todo/ }).querySelector(".chakra-icon");
		i(f.getBoundingClientRect().width).toBe(12), await r.keyboard("{Escape}");
	}
}, u = {
	render: () => /* @__PURE__ */ o(a, {
		storageKey: "storybook-existing-or",
		filter: {
			conjunction: "or",
			rules: [{
				attributeId: "status",
				condition: "is-any-of",
				value: ["todo"]
			}, {
				attributeId: "priority",
				condition: "is-any-of",
				value: ["high"]
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let a = e(t);
		await i(a.getByRole("button", { name: "Edit advanced filter" })).toHaveTextContent(" or "), await r.click(a.getByRole("button", { name: "Edit advanced filter" })), await n(() => i(e(t.ownerDocument.body).getByTestId("advanced-filter-popover")).toBeVisible());
	}
}, d = {
	render: () => /* @__PURE__ */ o(a, {
		storageKey: "storybook-clear-all-filters",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "status",
				condition: "is-any-of",
				value: ["todo"]
			}],
			groups: [{
				conjunction: "or",
				rules: [{
					attributeId: "priority",
					condition: "is-any-of",
					value: ["high"]
				}]
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t), a = e(t.ownerDocument.body), o = n.getByRole("button", {
			name: "Filter",
			exact: !0
		});
		i(o.textContent?.trim()).toBe("2"), await r.click(o);
		let s = await a.findByTestId("filter-menu-footer");
		await r.click(e(s).getByRole("button", {
			name: "Clear all",
			exact: !0
		})), i(o.textContent?.trim()).toBe(""), await i(n.getByRole("button", {
			name: "Filter",
			exact: !0
		})).toBeVisible(), await i(n.getByLabelText("Unsaved view changes")).toBeVisible();
	}
}, f = {
	render: () => /* @__PURE__ */ o(a, {
		storageKey: "storybook-clear-advanced-draft",
		filter: {
			conjunction: "and",
			rules: [],
			groups: [{
				conjunction: "and",
				rules: []
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = e(t.ownerDocument.body);
		i(a.getByRole("button", { name: "Edit advanced filter" })).toBeVisible(), await r.click(a.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let s = await o.findByTestId("filter-menu-footer"), c = e(s).getByRole("button", {
			name: "Clear all",
			exact: !0
		});
		i(c).toBeEnabled(), await r.click(c), await n(() => i(o.queryByTestId("filter-menu")).toBeNull()), i(a.queryByRole("button", { name: "Edit advanced filter" })).toBeNull(), i(a.getByLabelText("Unsaved view changes")).toBeVisible();
	}
};
export { f as ClearAdvancedDraft, d as ClearAllFilters, u as ExistingOrView, c as NestedExactDateField, l as NormalAndAdvanced, s as default };
