// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./alert-D8nHP1tF.ts";
import { n as a, r as o, t as s } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
import { t as c } from "./kanban-renderer-DXp4dq2X.ts";
import { useState as l } from "react";
import { Badge as u, Box as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-regressions.stories.tsx
var m = {
	title: "Patterns/Kanban Renderer/Regression Cases",
	component: c,
	parameters: { layout: "fullscreen" }
}, h = () => {
	let [e, t] = l(o);
	return /* @__PURE__ */ f(d, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ f(c, {
			rows: e,
			storageKey: "storybook-kanban-renderer-editable-badge",
			attributes: s,
			defaultSettings: {
				viewMode: "board",
				columnGrouping: "status",
				rowGrouping: "none",
				displayProperties: ["status"]
			},
			onAttributeChange: (e, n, r) => {
				t((t) => t.map((t) => t.id === e ? {
					...t,
					attributes: {
						...t.attributes,
						[n]: r
					}
				} : t));
			},
			getBoardColumnConfig: (e) => ({
				color: a[e] ?? "gray",
				canCreate: !1
			})
		})
	});
}, g = {
	tags: ["editable-display-badge-regression"],
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getByTestId("board-column-todo"), o = i.getByTestId("board-column-done"), s = e(a).getByText("Set up API authentication").closest("[data-testid=\"renderer-card\"]");
		if (!s) throw Error("Expected the ticket card to render in the Todo column");
		await n.click(e(s).getByText("Todo")), await n.click(e(document.body).getByRole("menuitemradio", { name: "Done" })), await r(e(o).getByText("Set up API authentication")).toBeInTheDocument(), await r(e(a).queryByText("Set up API authentication")).not.toBeInTheDocument();
	}
}, _ = () => {
	let [e, t] = l(o), n = s.map((e) => e.id === "priority" ? {
		...e,
		editable: !0
	} : e);
	return /* @__PURE__ */ f(d, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ f(c, {
			rows: e,
			storageKey: "storybook-kanban-renderer-clearable-single-badge",
			attributes: n,
			defaultSettings: {
				viewMode: "board",
				columnGrouping: "status",
				rowGrouping: "none",
				displayProperties: ["priority"]
			},
			onAttributeChange: (e, n, r) => t((t) => t.map((t) => t.id === e ? {
				...t,
				attributes: {
					...t.attributes,
					[n]: r
				}
			} : t))
		})
	});
}, v = {
	tags: ["clearable-single-select-badge-regression"],
	render: () => /* @__PURE__ */ f(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t).getByText("Set up API authentication").closest("[data-testid=\"renderer-card\"]");
		if (!i) throw Error("Expected the ticket card to render");
		await n.click(e(i).getByText("High")), await r(e(document.body).queryByRole("menuitemradio", { name: "No Priority" })).not.toBeInTheDocument(), await n.click(e(document.body).getByRole("menuitemradio", { name: "High" })), await r(e(i).queryByText("High")).not.toBeInTheDocument();
	}
}, y = () => {
	let [e, t] = l(o), n = s.map((e) => e.id === "labels" ? {
		...e,
		editable: !0
	} : e);
	return /* @__PURE__ */ f(d, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ f(c, {
			rows: e,
			storageKey: "storybook-kanban-renderer-editable-multi-badge",
			attributes: n,
			defaultSettings: {
				viewMode: "board",
				columnGrouping: "status",
				rowGrouping: "none",
				displayProperties: ["labels"]
			},
			onAttributeChange: (e, n, r) => {
				t((t) => t.map((t) => t.id === e ? {
					...t,
					attributes: {
						...t.attributes,
						[n]: r
					}
				} : t));
			},
			getBoardColumnConfig: (e) => ({
				color: a[e] ?? "gray",
				canCreate: !1
			})
		})
	});
}, b = {
	render: () => /* @__PURE__ */ f(y, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i).getByTestId("board-column-todo"), o = e(a).getByText("Set up API authentication").closest("[data-testid=\"renderer-card\"]");
		if (!o) throw Error("Expected the ticket card to render in the Todo column");
		let s = e(o).getByText("Bug");
		await n.hover(s), await t(() => r(e(document.body).queryByRole("menu")).not.toBeInTheDocument()), await n.click(s), await n.click(e(document.body).getByRole("menuitemcheckbox", { name: "Regression" })), await r(e(document.body).getByRole("menuitemcheckbox", { name: "Bug" })).toHaveAttribute("aria-checked", "true"), await r(e(document.body).getByRole("menuitemcheckbox", { name: "Regression" })).toHaveAttribute("aria-checked", "true");
	}
}, x = o.slice(0, 4).map((e, t) => ({
	...e,
	attributes: {
		...e.attributes,
		diffOverview: `+${[
			18,
			4,
			0,
			27
		][t]} -${[
			3,
			12,
			0,
			8
		][t]}`
	}
})), S = [...s, {
	id: "diffOverview",
	label: "Diff",
	type: { kind: "string" },
	displayable: !0,
	render: (e) => /* @__PURE__ */ f(u, {
		variant: "subtle",
		colorPalette: "green",
		textStyle: "label/XS/medium",
		children: String(e)
	})
}], C = { render: () => /* @__PURE__ */ f(d, {
	p: "sm",
	height: "560px",
	children: /* @__PURE__ */ f(c, {
		rows: x,
		storageKey: "storybook-kanban-renderer-custom-attribute",
		attributes: S,
		defaultSettings: {
			viewMode: "board",
			columnGrouping: "status",
			rowGrouping: "none",
			displayProperties: ["diffOverview", "status"]
		},
		defaultSorts: [{
			attributeId: "updated",
			direction: "desc"
		}]
	})
}) }, w = [...s, {
	id: "workspace",
	label: "Workspace",
	type: { kind: "string" },
	displayable: !0,
	display: {
		kind: "badge-list",
		itemsAttributeId: "workspaceItems"
	}
}], T = o.slice(0, 4).map((e, t) => ({
	...e,
	attributes: {
		...e.attributes,
		workspace: `workspace-${t + 1}`,
		workspaceItems: [{
			id: `workspace-${t + 1}`,
			label: `${e.id}_A1`,
			icon: t % 2 == 0 ? "GitBranch" : "GitCommit"
		}]
	}
})), E = { render: () => /* @__PURE__ */ f(d, {
	p: "sm",
	height: "560px",
	children: /* @__PURE__ */ f(c, {
		rows: T,
		storageKey: "storybook-kanban-renderer-workspace-display",
		attributes: w,
		defaultSettings: {
			viewMode: "board",
			columnGrouping: "status",
			rowGrouping: "none",
			displayProperties: ["workspace", "priority"]
		},
		defaultSorts: [{
			attributeId: "updated",
			direction: "desc"
		}]
	})
}) }, D = () => {
	let [e, t] = l();
	return /* @__PURE__ */ p(d, {
		p: "sm",
		height: "560px",
		children: [e ? /* @__PURE__ */ f(i, {
			status: "error",
			title: e,
			onClose: () => t(void 0)
		}) : null, /* @__PURE__ */ f(c, {
			rows: o,
			attributes: s,
			storageKey: "storybook-kanban-failed-action",
			defaultSettings: {
				viewMode: "board",
				columnGrouping: "status",
				displayProperties: ["status"]
			},
			onAttributeChange: async () => {
				throw Error("Could not save the change.");
			},
			onActionError: (e) => t(e instanceof Error ? e.message : String(e))
		})]
	});
}, O = {
	render: () => /* @__PURE__ */ f(D, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getByTestId("board-column-todo"), o = e(a).getByText("Set up API authentication").closest("[data-testid=\"renderer-card\"]");
		if (!o) throw Error("Expected the ticket card");
		await n.click(e(o).getByText("Todo")), await n.click(e(document.body).getByRole("menuitemradio", { name: "Done" })), await r(i.getByText("Could not save the change.")).toBeVisible(), await r(e(a).getByText("Set up API authentication")).toBeVisible();
	}
};
export { v as ClearSingleSelectBadgeByRepicking, C as CustomAttributeRenderer, g as EditableDisplayBadge, b as EditableMultiSelectBadge, O as FailedAction, E as WorkspaceDisplayProperty, m as default };
