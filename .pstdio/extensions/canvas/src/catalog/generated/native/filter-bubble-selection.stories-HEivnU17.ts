// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./collection-view-bar-story-Djy9rHNd.ts";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/filter-bubble-selection.stories.tsx
var s = {
	title: "Patterns/Collection View/Filter Bubble Selection",
	parameters: { layout: "fullscreen" }
}, c = {
	render: () => /* @__PURE__ */ o(a, { storageKey: "storybook-complete-number" }),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = e(t.ownerDocument.body);
		await r.click(a.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let s = await o.findByTestId("filter-menu");
		await r.click(e(s).getByRole("button", {
			name: "Score",
			exact: !0
		}));
		let c = e(s).getByRole("spinbutton", { name: "Value" });
		await r.type(c, "-12.5", { delay: 20 }), await i(c).toHaveValue("-12.5"), i(a.queryByRole("group", { name: "Score filter" })).toBeNull(), await r.click(e(s).getByRole("button", { name: "Apply filter" }));
		let l = e(a.getByRole("group", { name: "Score filter" }));
		await i(l.getByRole("spinbutton", { name: "Value" })).toHaveValue(-12.5), await n(() => i(s).not.toBeVisible());
	}
}, l = {
	render: () => /* @__PURE__ */ o(a, { storageKey: "storybook-value-handoff" }),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = e(t.ownerDocument.body);
		await r.click(a.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let s = await o.findByTestId("filter-menu"), c = e(s);
		await r.click(c.getByRole("button", {
			name: "Priority",
			exact: !0
		})), i(a.queryByRole("group", { name: "Priority filter" })).toBeNull(), await Promise.all(s.closest("[data-part=content]").getAnimations({ subtree: !0 }).map((e) => e.finished));
		let l = s.getBoundingClientRect();
		await r.click(c.getByRole("checkbox", {
			name: "High",
			exact: !0
		})), await i(s).toBeVisible(), await n(() => i(s.getBoundingClientRect().top).toBe(l.top)), i(s.getBoundingClientRect().left).toBe(l.left);
		let u = e(a.getByRole("group", { name: "Priority filter" }));
		await i(u.getByRole("button", { name: "Values" })).toHaveTextContent("High"), await i(c.getByRole("checkbox", {
			name: "High",
			exact: !0
		})).toHaveAttribute("aria-checked", "true"), await r.click(c.getByRole("checkbox", {
			name: "Medium",
			exact: !0
		})), await i(u.getByRole("button", { name: "Condition" })).toHaveTextContent("is any of"), await i(u.getByRole("button", { name: "Values" })).toHaveTextContent("High, Medium");
		let d = c.getByRole("checkbox", {
			name: "High",
			exact: !0
		}).querySelector("[data-part=control]");
		i(d.getBoundingClientRect().width).toBe(12), await r.click(c.getByRole("checkbox", {
			name: "High",
			exact: !0
		})), await r.click(c.getByRole("checkbox", {
			name: "Medium",
			exact: !0
		})), i(a.queryByRole("group", { name: "Priority filter" })).toBeNull(), await i(s).toBeVisible(), await r.click(c.getByRole("checkbox", {
			name: "Low",
			exact: !0
		})), await r.keyboard("{Escape}"), await n(() => i(s).not.toBeVisible()), await r.click(e(a.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" })), await r.click(o.getByRole("menuitem", {
			name: "is not",
			exact: !0
		})), await i(e(a.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
	}
}, u = {
	render: () => /* @__PURE__ */ o(a, { storageKey: "storybook-text-filter-entry" }),
	play: async ({ canvasElement: t }) => {
		let n = e(t), a = e(t.ownerDocument.body);
		await r.click(n.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let o = await a.findByTestId("filter-menu");
		await r.click(e(o).getByRole("button", {
			name: "Title",
			exact: !0
		})), i(n.queryByRole("group", { name: "Title filter" })).toBeNull(), await r.click(e(o).getByRole("button", {
			name: "Apply filter",
			exact: !0
		}));
		let s = e(n.getByRole("group", { name: "Title filter" })), c = await s.findByRole("textbox", { name: "Value" });
		i(getComputedStyle(c).outlineStyle).toBe("none"), await r.type(c, "review"), await r.keyboard("{Enter}"), await i(s.getByText("review", { exact: !0 })).toBeVisible(), await r.click(s.getByText("review", { exact: !0 })), await r.clear(s.getByRole("textbox", { name: "Value" })), await r.type(s.getByRole("textbox", { name: "Value" }), "urgent"), await r.keyboard("{Enter}"), await i(s.getByText("urgent", { exact: !0 })).toBeVisible();
	}
}, d = {
	render: () => /* @__PURE__ */ o(a, { storageKey: "storybook-date-parameter-fields" }),
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = e(a.ownerDocument.body);
		await r.click(o.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let c = await s.findByTestId("filter-menu");
		await r.click(e(c).getByRole("button", {
			name: "Updated",
			exact: !0
		}));
		let l = e(c).getByLabelText("Value");
		await n(() => i(l.getBoundingClientRect().height).toBe(32));
		let u = c.querySelector("[data-testid=\"filter-value-column\"]");
		i(l.getBoundingClientRect().left - u.getBoundingClientRect().left).toBe(12), i(l.getBoundingClientRect().right).toBeLessThanOrEqual(u.getBoundingClientRect().right), t.change(l, { target: { value: "2026-10-04" } }), await r.click(e(c).getByRole("button", { name: "Apply filter" })), await n(() => i(s.queryByTestId("filter-menu")).toBeNull());
		let d = e(o.getByRole("group", { name: "Updated filter" }));
		await i(d.getByRole("button", { name: "Values" })).toHaveTextContent((/* @__PURE__ */ new Date("2026-10-04T00:00:00")).toLocaleDateString()), await i(await s.findByLabelText("Value")).toHaveValue("2026-10-04"), await r.keyboard("{Escape}"), await n(() => i(s.queryByLabelText("Value")).toBeNull()), await r.click(d.getByRole("button", { name: "Values" }));
		let f = await s.findByLabelText("Value");
		t.change(f, { target: { value: "2026-10-05" } }), await i(f).toHaveValue("2026-10-05"), await n(() => i(d.getByRole("button", { name: "Values" })).toHaveTextContent((/* @__PURE__ */ new Date("2026-10-05T00:00:00")).toLocaleDateString()));
	}
};
export { l as ChooseValueThenContinue, c as CompleteNumberEntry, d as DateParameterFields, u as TextEntry, s as default };
