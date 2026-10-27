// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./collection-view-bar-DZiXTxjX.ts";
import { n as a } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { t as o } from "./collection-view-bar-story-C6uj6GIB.ts";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-bar.stories.tsx
var c = {
	title: "Patterns/Collection View/Collection View Bar",
	component: i,
	parameters: { layout: "fullscreen" }
}, l = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-user-owned-views",
		filter: a
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await n.pointer({
			keys: "[MouseRight]",
			target: a.getByRole("tab", { name: "All tickets" })
		}), await n.click(await o.findByRole("menuitem", {
			name: "Rename",
			exact: !0
		}));
		let s = await o.findByRole("textbox", { name: "View name" });
		await n.clear(s), await n.type(s, "Team tickets"), await n.click(o.getByRole("button", {
			name: "Rename",
			exact: !0
		})), await r(await a.findByRole("tab", { name: "Team tickets" })).toBeVisible(), await n.click(a.getByRole("button", {
			name: "Remove Status filter",
			exact: !0
		})), await n.click(a.getByRole("button", {
			name: "Save view",
			exact: !0
		})), await t(() => r(a.queryByLabelText("Unsaved view changes")).not.toBeInTheDocument()), await n.pointer({
			keys: "[MouseRight]",
			target: a.getByRole("tab", { name: "Team tickets" })
		}), await n.click(await o.findByRole("menuitem", {
			name: "Delete view",
			exact: !0
		})), await t(() => r(a.queryByRole("tab", { name: "Team tickets" })).not.toBeInTheDocument()), await n.pointer({
			keys: "[MouseRight]",
			target: a.getByRole("tab", { name: "My work" })
		}), await r(await o.findByRole("menuitem", {
			name: "Delete view",
			exact: !0
		})).toHaveAttribute("data-disabled", ""), await r(o.getByRole("menuitem", {
			name: "Rename",
			exact: !0
		})).not.toHaveAttribute("data-disabled"), await n.keyboard("{Escape}");
	}
}, u = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-saved-sorts",
		editedSorts: [{
			attributeId: "title",
			direction: "asc"
		}]
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		await n.click(await a.findByRole("button", {
			name: "Save view",
			exact: !0
		})), await t(() => r(a.queryByLabelText("Unsaved view changes")).not.toBeInTheDocument());
	}
}, d = {
	render: () => /* @__PURE__ */ s(o, { storageKey: "storybook-text-filter-editing" }),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let o = e(await a.findByTestId("filter-menu"));
		await n.click(o.getByRole("button", {
			name: "Title",
			exact: !0
		})), await n.click(o.getByRole("button", {
			name: "Apply filter",
			exact: !0
		}));
		let s = i.getByRole("group", { name: "Title filter" }), c = e(s).getByRole("textbox", {
			name: "Value",
			exact: !0
		});
		await n.type(c, "gypq");
		let l = s.getBoundingClientRect(), u = c.getBoundingClientRect();
		r(u.height).toBeGreaterThan(Number.parseFloat(getComputedStyle(c).lineHeight)), r(Math.abs(u.top + u.height / 2 - l.top - l.height / 2)).toBeLessThanOrEqual(1), await n.keyboard("{Enter}"), await r(e(s).getByText("gypq", { exact: !0 })).toBeVisible(), await n.click(e(s).getByText("gypq", { exact: !0 })), await n.clear(e(s).getByRole("textbox", {
			name: "Value",
			exact: !0
		})), await n.type(e(s).getByRole("textbox", {
			name: "Value",
			exact: !0
		}), "updated"), await n.keyboard("{Enter}"), await r(e(s).getByText("updated", { exact: !0 })).toBeVisible();
	}
}, f = {
	render: () => /* @__PURE__ */ s(o, { storageKey: "storybook-collection-view-bar-no-rules" }),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await n.click(a.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let s = await o.findByTestId("filter-menu-popover");
		await n.click(e(s).getByRole("checkbox", {
			name: "Todo",
			exact: !0
		})), await r(a.getByRole("group", { name: "Status filter" })).toBeVisible(), await r(s).toBeVisible();
		let c = await o.findByTestId("filter-menu-footer");
		await n.click(e(c).getByRole("button", {
			name: "Clear all",
			exact: !0
		})), await t(() => r(s).not.toBeVisible()), await r(a.getByRole("button", {
			name: "Filter",
			exact: !0
		})).toBeVisible();
	}
}, p = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-collection-view-bar-saved",
		filter: a,
		sorts: [{
			attributeId: "priority",
			direction: "asc"
		}]
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t), i = e(n.getByRole("group", { name: "Status filter" }));
		await r(i.getByRole("button", { name: "Condition" })).toHaveTextContent("is not"), await r(i.getByRole("button", { name: "Values" })).toHaveTextContent("Done"), await r(n.queryByRole("button", { name: "Save view" })).not.toBeInTheDocument();
	}
}, m = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-shared-property-picker",
		filter: a
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body), s = e(a.getByRole("group", { name: "Status filter" }));
		r(getComputedStyle(s.getByRole("button", { name: "Condition" })).color).not.toBe(getComputedStyle(s.getByText("Status", { exact: !0 })).color);
		{
			await n.click(a.getByRole("button", {
				name: "Filter",
				exact: !0
			}));
			let i = await o.findByTestId("filter-menu");
			await t(() => r(e(i).getByRole("textbox", { name: "Filter properties" })).toBeVisible()), await r(e(i).getByRole("checkbox", {
				name: "Done",
				exact: !0
			})).toHaveAttribute("aria-checked", "true"), await n.keyboard("{Escape}");
		}
	}
}, h = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-picker-handoff",
		filter: a
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let o = await a.findByTestId("filter-menu");
		await n.click(e(o).getByRole("button", {
			name: "Labels",
			exact: !0
		})), await n.click(e(o).getByRole("checkbox", {
			name: "Bug",
			exact: !0
		})), await r(o).toBeVisible(), await n.click(e(o).getByRole("checkbox", {
			name: "Regression",
			exact: !0
		})), await r(e(i.getByRole("group", { name: "Labels filter" })).getByRole("button", { name: "Values" })).toHaveTextContent("Bug, Regression");
	}
}, g = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-collection-view-bar-unsaved",
		filter: a,
		editedSorts: [{
			attributeId: "score",
			direction: "desc"
		}]
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await r(await n.findByLabelText("Unsaved view changes")).toBeVisible(), await r(n.getByRole("button", { name: "Save view" })).toBeVisible();
	}
}, _ = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-collection-view-bar-search",
		filter: a
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		await n.click(i.getByRole("button", { name: "Search this view" })), await n.type(i.getByRole("textbox", { name: "Search this view" }), "filter"), await r(i.getByText("4 of 10")).toBeVisible(), await r(i.queryByLabelText("Unsaved view changes")).not.toBeInTheDocument();
	}
}, v = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-collection-view-boolean",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "archived",
				condition: "is",
				value: !1
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t).getByRole("group", { name: "Archived filter" });
		await r(e(i).getByText("Ticket", { exact: !0 })).toHaveTextContent("Ticket"), await r(e(i).getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
		let a = e(t.ownerDocument.body);
		await n.click(e(i).getByRole("button", { name: "Condition" })), await n.click(await a.findByRole("menuitem", {
			name: "is",
			exact: !0
		})), await r(e(i).getByRole("button", { name: "Condition" })).toHaveTextContent("is");
	}
}, y = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-sort-choices",
		sorts: [{
			attributeId: "updated",
			direction: "desc"
		}]
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await n.click(a.getByRole("button", { name: "Display settings" })), await n.click(await o.findByRole("button", { name: "Sort direction" }));
		let s = await o.findByRole("menu"), c = e(s).getByRole("menuitem", { name: "Newest first" }), l = e(s).getByRole("menuitem", { name: "Oldest first" });
		await r(c.querySelector(".lucide-check")).toBeInTheDocument(), await t(() => {
			let e = s.getBoundingClientRect();
			for (let t of [c, l]) {
				let n = t.getBoundingClientRect();
				r(n.top).toBeGreaterThanOrEqual(e.top), r(n.bottom).toBeLessThanOrEqual(e.bottom);
			}
		}), await n.click(l), await n.click(o.getByRole("button", { name: "Sort direction" }));
		let u = await o.findByRole("menu");
		await r(e(u).getByRole("menuitem", { name: "Oldest first" }).querySelector(".lucide-check")).toBeInTheDocument(), await n.click(e(u).getByRole("menuitem", { name: "Newest first" })), await r(o.getByRole("button", { name: "Sort direction" })).toHaveTextContent("Newest first"), await n.click(o.getByRole("button", { name: "Ordering" })), await n.click(o.getByRole("menuitem", {
			name: "None",
			exact: !0
		})), await r(o.getByRole("button", { name: "Ordering" })).toHaveTextContent("None"), await r(o.queryByRole("button", { name: "Sort direction" })).not.toBeInTheDocument();
	}
}, b = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-independent-filter-choices",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "status",
				condition: "is-any-of",
				value: ["todo"]
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body), o = e(i.getByRole("group", { name: "Status filter" }));
		await r(o.getByText("Status", { exact: !0 })).toBeVisible(), await n.click(o.getByRole("button", { name: "Condition" })), await r(a.getAllByRole("menuitem")).toHaveLength(2), await n.click(a.getByRole("menuitem", {
			name: "is not",
			exact: !0
		})), await n.click(o.getByRole("button", { name: "Values" }));
		let s = a.getByRole("menuitemcheckbox", { name: /Todo/ }), c = a.getByRole("menuitemcheckbox", { name: /Done/ }), l = s.querySelector("p").getBoundingClientRect(), u = s.querySelector("[data-part=control]").getBoundingClientRect();
		r(u.left).toBeGreaterThan(l.right), await r(s).toHaveAttribute("aria-checked", "true"), await r(s.querySelector(".lucide-circle")).toBeInTheDocument(), await n.click(c), await r(c).toHaveAttribute("aria-checked", "true"), await r(s).toBeVisible(), await n.click(s), await r(s).toHaveAttribute("aria-checked", "false"), await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("Done"), await n.keyboard("{Escape}");
	}
}, x = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-empty-option-predicate",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "status",
				condition: "is-empty"
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body), o = e(i.getByRole("group", { name: "Status filter" }));
		await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("Empty"), await n.click(o.getByRole("button", { name: "Condition" })), await n.click(a.getByRole("menuitem", {
			name: "is not",
			exact: !0
		})), await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("Empty"), await n.click(o.getByRole("button", { name: "Values" })), await n.click(a.getByRole("menuitemcheckbox", { name: /Done/ })), await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("Done"), await r(o.getByRole("button", { name: "Condition" })).toHaveTextContent("is not"), await n.keyboard("{Escape}");
	}
}, S = {
	render: () => /* @__PURE__ */ s(o, {
		storageKey: "storybook-all-values-predicate",
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "labels",
				condition: "has-all-of",
				value: ["bug"]
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body), o = e(i.getByRole("group", { name: "Labels filter" }));
		await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug"), await n.click(o.getByRole("button", { name: "Condition" })), await n.click(await a.findByRole("menuitem", {
			name: "is",
			exact: !0
		})), await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug"), await n.click(o.getByRole("button", { name: "Values" })), await n.click(a.getByRole("menuitemcheckbox", { name: /Regression/ })), await r(o.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug, Regression"), await n.keyboard("{Escape}");
	}
};
export { S as AllValuesPredicate, v as BooleanPredicate, x as EmptyOptionPredicate, b as IndependentFilterChoices, y as NestedSortChoices, f as NoRules, h as PickerSelection, p as RulesSaved, u as SavedSorts, _ as SearchOpen, m as SharedPropertyPicker, d as TextFilterEditing, g as UnsavedChanges, l as UserOwnedViews, c as default };
