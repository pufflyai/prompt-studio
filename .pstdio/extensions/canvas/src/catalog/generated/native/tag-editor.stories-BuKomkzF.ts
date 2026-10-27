// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./circle-dashed-B1ik78oL.ts";
import { n as i, t as a } from "./hexagon-YdIN8koD.ts";
import { t as o } from "./square-CKYOWRAv.ts";
import { t as s } from "./trash-2-C03vrbuo.ts";
import { t as c } from "./scroll-area-I7hjn89T.ts";
import { t as l } from "./segmented-control-DSBHC0XI.ts";
import { n as u, t as d } from "./tag-editor-CDVAJUas.ts";
import { useState as f } from "react";
import { Box as p, Button as m, Flex as h, HStack as g, Stack as _ } from "@chakra-ui/react";
import { jsx as v, jsxs as y } from "react/jsx-runtime";
// packages/ui/src/components/tag-editor/tag-editor-save-bar.tsx
var b = (e) => {
	let { onSave: t, onReset: n, hasChanges: r, isSaving: i, resetLabel: a = "Reset", saveLabel: o = "Save" } = e;
	return /* @__PURE__ */ y(g, {
		gap: "xs",
		children: [r ? /* @__PURE__ */ v(m, {
			size: "sm",
			variant: "ghost",
			onClick: n,
			disabled: i,
			children: a
		}) : null, /* @__PURE__ */ v(m, {
			size: "sm",
			variant: "primary",
			onClick: t,
			loading: i,
			disabled: !r,
			children: o
		})]
	});
}, x = [
	{
		id: "low",
		name: "Low",
		color: "gray",
		icon: "level-low",
		sortOrder: 10
	},
	{
		id: "medium",
		name: "Medium",
		color: "yellow",
		icon: "level-mid",
		sortOrder: 20
	},
	{
		id: "high",
		name: "High",
		color: "orange",
		icon: "level-high",
		sortOrder: 30
	},
	{
		id: "urgent",
		name: "Urgent",
		color: "red",
		icon: "flame",
		sortOrder: 40
	}
], S = [
	{
		value: null,
		label: "circle",
		icon: r
	},
	{
		value: "diamond",
		label: "diamond",
		icon: i
	},
	{
		value: "hexagon",
		label: "hexagon",
		icon: a
	},
	{
		value: "square",
		label: "square",
		icon: o
	}
], C = {
	title: "Components/Inputs/Tag Editor",
	component: d,
	decorators: [(e) => /* @__PURE__ */ v(p, {
		padding: "lg",
		background: "bg",
		maxWidth: "720px",
		children: /* @__PURE__ */ v(e, {})
	})]
}, w = { render: () => {
	let [e, t] = f(x);
	return /* @__PURE__ */ y(_, {
		gap: "md",
		children: [/* @__PURE__ */ v(d, {
			title: "Priority",
			values: e,
			onValuesChange: t
		}), /* @__PURE__ */ v(b, {
			hasChanges: !0,
			onSave: () => void 0,
			onReset: () => t(x)
		})]
	});
} }, T = { render: () => {
	let [e, t] = f(Array.from({ length: 20 }, (e, t) => ({
		id: String(t),
		name: `Option ${t + 1}`,
		color: "blue",
		sortOrder: t
	})));
	return /* @__PURE__ */ y(_, {
		h: "360px",
		minH: "0",
		gap: "0",
		children: [/* @__PURE__ */ y(h, {
			layerStyle: "settingsHeader",
			flexShrink: "0",
			justifyContent: "space-between",
			alignItems: "center",
			children: [/* @__PURE__ */ v(u, {
				hasChanges: !0,
				children: "Ticket tags"
			}), /* @__PURE__ */ v(b, {
				hasChanges: !0,
				onSave: () => void 0,
				onReset: () => void 0
			})]
		}), /* @__PURE__ */ v(c, {
			flex: "1",
			minH: "0",
			contentProps: { p: "lg" },
			children: /* @__PURE__ */ v(d, {
				title: "Track",
				values: e,
				onValuesChange: t
			})
		})]
	});
} }, E = {
	render: () => {
		let [e, t] = f(x);
		return /* @__PURE__ */ v(d, {
			title: "Priority",
			values: e,
			onValuesChange: t
		});
	},
	play: async ({ canvasElement: n }) => {
		await t.hover(e(n).getByText("Low"));
	}
}, D = { render: () => {
	let [e, t] = f([{
		id: "new-priority",
		name: "New option",
		color: "blue",
		icon: "circle",
		sortOrder: 0,
		isNew: !0
	}, ...x]);
	return /* @__PURE__ */ v(d, {
		title: "Priority",
		values: e,
		onValuesChange: t
	});
} }, O = {
	render: () => {
		let [e, t] = f(x);
		return /* @__PURE__ */ y(_, {
			gap: "sm",
			children: [/* @__PURE__ */ v(d, {
				title: "Priority",
				values: e,
				onValuesChange: t
			}), /* @__PURE__ */ v(m, {
				size: "sm",
				alignSelf: "flex-start",
				onClick: () => t(x),
				children: "Reset"
			})]
		});
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByText("Low"));
		let a = i.getByRole("textbox");
		await t.clear(a), await t.type(a, "Low reviewed{enter}"), await n(i.getByText("Low reviewed")).toBeVisible(), await t.click(i.getByRole("button", { name: "Reset" })), await n(i.getByText("Low")).toBeVisible(), await n(i.queryByText("Low reviewed")).not.toBeInTheDocument();
	}
}, k = {
	render: () => {
		let [e, t] = f(x);
		return /* @__PURE__ */ v(d, {
			title: "Priority",
			values: e,
			onValuesChange: t
		});
	},
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await t.pointer([{
			target: r.getByLabelText("Reorder Low"),
			keys: "[MouseLeft>]"
		}, { target: r.getByLabelText("Reorder Medium") }]);
	}
}, A = { render: () => {
	let [e, t] = f(x), [n, r] = f("single_select");
	return /* @__PURE__ */ y(_, {
		gap: "md",
		children: [/* @__PURE__ */ v(d, {
			title: "Priority",
			values: e,
			onValuesChange: t,
			headerActions: /* @__PURE__ */ y(g, {
				gap: "xs",
				children: [/* @__PURE__ */ v(l, {
					value: n,
					onValueChange: r,
					"aria-label": "Selection mode",
					options: [{
						value: "single_select",
						label: "Single"
					}, {
						value: "multi_select",
						label: "Multiple"
					}]
				}), /* @__PURE__ */ v(m, {
					size: "xs",
					variant: "destructive-ghost",
					"aria-label": "Delete tag",
					children: /* @__PURE__ */ v(s, { size: 14 })
				})]
			})
		}), /* @__PURE__ */ v(b, {
			hasChanges: !0,
			onSave: () => void 0,
			onReset: () => t(x)
		})]
	});
} }, j = { render: () => {
	let [e, t] = f([
		{
			id: "backlog",
			name: "Backlog",
			color: "gray",
			icon: "status-backlog",
			sortOrder: 10
		},
		{
			id: "todo",
			name: "Todo",
			color: "blue",
			icon: "status-todo",
			sortOrder: 20
		},
		{
			id: "progress",
			name: "In progress",
			color: "yellow",
			icon: "status-progress",
			sortOrder: 30
		},
		{
			id: "review",
			name: "In review",
			color: "purple",
			icon: "status-review",
			sortOrder: 40
		},
		{
			id: "done",
			name: "Done",
			color: "green",
			icon: "status-done",
			sortOrder: 50
		},
		{
			id: "canceled",
			name: "Canceled",
			color: "red",
			icon: "status-canceled",
			sortOrder: 60
		}
	]);
	return /* @__PURE__ */ v(d, {
		title: "Status",
		values: e,
		onValuesChange: t
	});
} }, M = { render: () => {
	let [e, t] = f([
		{
			id: "todo",
			name: "todo",
			color: "gray",
			sortOrder: 10,
			isDefault: !0
		},
		{
			id: "doing",
			name: "doing",
			color: "blue",
			sortOrder: 20
		},
		{
			id: "done",
			name: "done",
			color: "green",
			sortOrder: 30
		}
	]);
	return /* @__PURE__ */ v(d, {
		title: "Attempt statuses",
		description: "Manage status options used for workspace attempt workflows.",
		values: e,
		onValuesChange: t,
		onSetDefault: (n) => t(e.map((e) => ({
			...e,
			isDefault: e.id === n.id
		}))),
		showDefault: !0,
		showIcons: !1
	});
} }, N = { render: () => {
	let [e, t] = f([
		{
			id: "backlog",
			name: "backlog",
			color: "gray",
			sortOrder: 10,
			isDefault: !0,
			actions: ["create"]
		},
		{
			id: "ready",
			name: "ready",
			color: "green",
			sortOrder: 20,
			actions: []
		},
		{
			id: "done",
			name: "done",
			color: "green",
			sortOrder: 30,
			actions: ["archive_all"]
		}
	]);
	return /* @__PURE__ */ v(d, {
		title: "Ticket statuses",
		description: "Manage status values and the commands each one offers.",
		values: e,
		onValuesChange: t,
		actionOptions: [{
			value: "create",
			label: "Create"
		}, {
			value: "archive_all",
			label: "Archive all"
		}],
		actionsLabel: "Commands",
		showDefault: !0,
		showIcons: !1,
		onSetDefault: (n) => t(e.map((e) => ({
			...e,
			isDefault: e.id === n.id
		})))
	});
} }, P = { render: () => /* @__PURE__ */ v(d, {
	title: "Release statuses",
	values: x,
	onValuesChange: () => void 0,
	readOnly: !0
}) }, F = { render: () => {
	let [e, t] = f([{
		id: "vip",
		name: "vip",
		color: "pink",
		icon: "diamond",
		sortOrder: 10
	}, {
		id: "internal",
		name: "internal",
		color: "teal",
		icon: "hexagon",
		sortOrder: 20
	}]);
	return /* @__PURE__ */ v(d, {
		title: "Ticket tags",
		description: "Manage tag values with a custom palette.",
		values: e,
		onValuesChange: t,
		colorOptions: [
			"pink",
			"teal",
			"cyan",
			"purple"
		],
		iconOptions: S,
		addLabel: "Add value",
		addName: "New value"
	});
} };
export { F as CustomPickerOptions, k as Dragging, O as ExternalReset, T as FixedSettingsHeader, E as Hover, P as ReadOnly, D as Renaming, N as WithActions, M as WithDefault, A as WithHeaderActions, w as WithIcons, j as WithStatusGlyphs, C as default };
