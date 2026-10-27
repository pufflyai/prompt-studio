// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./collection-view-types-69xG6kJd.ts";
import { t as i } from "./filter-menu-eRsMQha_.ts";
import { r as a, t as o } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { useState as s } from "react";
import { Box as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/filter-menu.stories.tsx
var f = {
	title: "Patterns/Collection View/Filter Menu",
	component: i
}, p = (e) => {
	let [t, n] = s(e.filter ?? r), [f, p] = s();
	return /* @__PURE__ */ d(c, {
		width: "440px",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "md",
		bg: "bg",
		padding: "2xs",
		children: [
			/* @__PURE__ */ u(i, {
				fields: o,
				filter: t,
				optionsFor: a,
				onSelectRule: (e) => {
					n({
						...t,
						rules: [e]
					}), p(e.attributeId);
				}
			}),
			/* @__PURE__ */ u(l, {
				"data-testid": "filter-value",
				textStyle: "label/XS",
				padding: "xs",
				children: JSON.stringify(t.rules)
			}),
			/* @__PURE__ */ u(l, {
				"data-testid": "picked-field",
				textStyle: "label/XS",
				padding: "xs",
				children: f
			})
		]
	});
}, m = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getByRole("checkbox", { name: "In progress" }), o = e(a).getByText("In progress").getBoundingClientRect(), s = a.querySelector("[data-part=control]").getBoundingClientRect();
		n(s.left).toBeGreaterThan(o.right), await t.click(a), await n(i.getByTestId("filter-value")).toHaveTextContent("\"condition\":\"is-any-of\""), n(s.width).toBe(12);
	}
}, h = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: /Title/ })), await n(i.getByTestId("filter-value")).toHaveTextContent("[]"), await t.click(i.getByRole("button", {
			name: "Apply filter",
			exact: !0
		})), await n(i.getByTestId("picked-field")).toHaveTextContent("title");
	}
}, g = {
	render: () => /* @__PURE__ */ u(p, { filter: {
		conjunction: "and",
		rules: [{
			attributeId: "status",
			condition: "is-any-of",
			value: ["todo", "done"]
		}]
	} }),
	play: async ({ canvasElement: t }) => {
		let r = e(t).getByTestId("filter-menu"), i = t.ownerDocument.defaultView.innerHeight;
		n(r.getBoundingClientRect().height).toBe(Math.min(480, i - 32));
	}
}, _ = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", {
			name: "Priority",
			exact: !0
		})), await n(i.getByRole("checkbox", {
			name: "High",
			exact: !0
		})).toBeVisible();
		let a = i.getByRole("textbox", { name: "Filter properties" });
		await t.type(a, "title"), n(i.queryByRole("checkbox", {
			name: "High",
			exact: !0
		})).toBeNull(), await t.click(i.getByRole("button", {
			name: "Title",
			exact: !0
		}));
		let o = i.getByRole("button", {
			name: "Apply filter",
			exact: !0
		}), s = o.closest("[data-testid=\"filter-value-column\"]");
		n(o.getBoundingClientRect().width).toBe(s.clientWidth - 24), n(o.getBoundingClientRect().height).toBe(32), await t.clear(a), await n(i.getByRole("button", {
			name: "Apply filter",
			exact: !0
		})).toBeVisible();
	}
}, v = {
	render: () => /* @__PURE__ */ u(p, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		for (let r of [
			"Archived",
			"Labels",
			"Priority"
		]) {
			await t.click(i.getByRole("button", {
				name: r,
				exact: !0
			}));
			let a = i.getByTestId("filter-value-column"), o = e(a).getByText("Value", { exact: !0 });
			if (await n(o).toBeVisible(), r === "Archived") for (let t of ["Yes", "No"]) await n(e(i.getByRole("button", {
				name: t,
				exact: !0
			})).getByRole("checkbox", { hidden: !0 })).not.toBeChecked();
			n(o.getBoundingClientRect().left - a.getBoundingClientRect().left).toBe(12);
		}
	}
}, y = () => {
	let [e, t] = s(r);
	return /* @__PURE__ */ u(c, {
		width: "440px",
		children: /* @__PURE__ */ u(i, {
			fields: o,
			filter: e,
			optionsFor: () => Array.from({ length: 30 }, (e, t) => ({
				value: String(t),
				label: `Option ${t}`
			})),
			onSelectRule: (n) => t({
				...e,
				rules: [n]
			}),
			onAddAdvanced: () => void 0,
			onClear: () => t(r)
		})
	});
}, b = {
	render: () => /* @__PURE__ */ u(y, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getByTestId("filter-value-column"), o = a.querySelector("[data-part=\"viewport\"]"), s = a.querySelector("[data-part=\"scrollbar\"]");
		n(getComputedStyle(s).width).toBe("2px"), n(o.getBoundingClientRect().bottom).toBe(a.getBoundingClientRect().bottom - 12), o.scrollTop = o.scrollHeight;
		let c = i.getByRole("checkbox", {
			name: "Option 29",
			exact: !0
		});
		await n(c).toBeVisible(), n(c.getBoundingClientRect().bottom).toBeLessThanOrEqual(a.getBoundingClientRect().bottom), await t.click(c), await n(c).toHaveAttribute("aria-checked", "true");
	}
}, x = {
	render: () => /* @__PURE__ */ u(c, {
		width: "440px",
		children: /* @__PURE__ */ u(i, {
			fields: o,
			filter: r,
			optionsFor: (e) => a(e).map((e, t) => ({
				...e,
				count: t === 0 ? 0 : 5
			})),
			onSelectRule: () => void 0
		})
	}),
	play: async ({ canvasElement: t }) => {
		let r = e(t), i = r.getByRole("checkbox", {
			name: "Todo",
			exact: !0
		}), a = r.getByRole("checkbox", {
			name: "In progress",
			exact: !0
		});
		await n(e(a).getByText("5", { exact: !0 })).toBeVisible(), n(e(i).queryByText("0", { exact: !0 })).toBeNull();
	}
}, S = {
	render: () => /* @__PURE__ */ u(p, { filter: {
		conjunction: "and",
		rules: [{
			attributeId: "archived",
			condition: "is-not",
			value: !0
		}]
	} }),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", {
			name: "Archived",
			exact: !0
		}));
		let a = i.getByRole("button", {
			name: "No",
			exact: !0
		}), o = i.getByRole("button", {
			name: "Yes",
			exact: !0
		});
		await n(e(a).getByRole("checkbox", { hidden: !0 })).toBeChecked(), await n(e(o).getByRole("checkbox", { hidden: !0 })).not.toBeChecked(), await t.click(o), await n(e(o).getByRole("checkbox", { hidden: !0 })).toBeChecked(), await n(e(a).getByRole("checkbox", { hidden: !0 })).not.toBeChecked();
	}
};
export { S as BooleanSelection, b as LongValueList, x as MatchCounts, m as OptionValues, _ as SearchPropertyScope, h as TextField, v as ValuePanelLabels, g as WithSelectedValues, f as default };
