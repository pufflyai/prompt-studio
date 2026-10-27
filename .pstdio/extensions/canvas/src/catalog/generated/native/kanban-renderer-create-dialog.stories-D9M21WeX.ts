// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./host-storage-CRtYziQh.ts";
import { t as i } from "./kanban-renderer-create-dialog-CrZ9QjvA.ts";
import { useState as a } from "react";
import { Button as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-create-dialog.stories.tsx
var l = [
	{
		id: "status",
		label: "Status",
		editable: !0,
		type: {
			kind: "enum",
			options: [
				{
					value: "todo",
					label: "Todo",
					color: "gray",
					icon: "circle"
				},
				{
					value: "ready",
					label: "Ready",
					color: "blue",
					icon: "circle"
				},
				{
					value: "done",
					label: "Done",
					color: "green",
					icon: "check-circle"
				}
			]
		}
	},
	{
		id: "type",
		label: "Type",
		editable: !0,
		type: {
			kind: "enum",
			options: [{
				value: "bug",
				label: "Bug",
				color: "red",
				icon: "bug"
			}, {
				value: "feature",
				label: "Feature",
				color: "purple",
				icon: "sparkles"
			}]
		}
	},
	{
		id: "priority",
		label: "Priority",
		editable: !0,
		type: {
			kind: "enum-multi",
			options: [{
				value: "high",
				label: "High",
				color: "orange",
				icon: "flame"
			}, {
				value: "low",
				label: "Low",
				color: "teal",
				icon: "flag"
			}]
		}
	},
	{
		id: "estimate",
		label: "Estimate",
		editable: !0,
		type: { kind: "number" }
	},
	{
		id: "created",
		label: "Created",
		type: { kind: "date" }
	}
], u = {
	title: "New ticket",
	submitLabel: "Create ticket",
	fields: [{
		id: "content",
		label: "Description",
		placeholder: "Describe the ticket...",
		type: "markdown",
		required: !0
	}, {
		id: "files",
		label: "Attach files",
		type: "files",
		multiple: !0
	}],
	labels: {
		cancel: "Cancel",
		properties: "Properties",
		submitError: "Could not create ticket",
		removeFile: "Remove file",
		submitWithoutOpening: "Create without opening"
	}
}, d = {
	title: "Patterns/Kanban Renderer/Create Dialog",
	component: i,
	parameters: { layout: "fullscreen" }
}, f = (e) => {
	let { config: t, onSubmit: n } = e, [u, d] = a(!0), [f] = a(() => {
		let e = /* @__PURE__ */ new Map();
		return {
			getItem: (t) => e.get(t) ?? null,
			setItem: (t, n) => {
				e.set(t, n);
			}
		};
	});
	return /* @__PURE__ */ c(r, {
		storage: f,
		children: [/* @__PURE__ */ s(o, {
			onClick: () => d(!0),
			children: "New ticket"
		}), /* @__PURE__ */ s(i, {
			open: u,
			columnId: "ready",
			columnAttributeId: "status",
			attributes: l,
			config: t,
			onClose: () => d(!1),
			onSubmit: n ?? (() => void 0)
		})]
	});
}, p = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: u }),
	play: async ({ canvasElement: t }) => {
		let r = e(t.ownerDocument.body);
		await n(await r.findByRole("button", {
			name: "Create ticket",
			exact: !0
		})).toBeDisabled(), await n(r.getByRole("button", {
			name: "Create without opening",
			exact: !0
		})).toBeDisabled();
	}
}, m = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: {
		...u,
		fields: [{
			...u.fields[0],
			defaultValue: "Ticket body"
		}, u.fields[1]]
	} })
}, h = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: {
		...u,
		fields: [{
			...u.fields[0],
			defaultValue: Array.from({ length: 40 }, (e, t) => `Requirement ${t + 1}: Keep the ticket details accessible while editing.`).join("\n\n")
		}, u.fields[1]]
	} }),
	play: async ({ canvasElement: t }) => {
		let r = e(t.ownerDocument.body), i = await r.findByRole("textbox"), a = r.getByRole("button", {
			name: "Attach files",
			exact: !0
		}), o = r.getByRole("button", {
			name: "Create ticket",
			exact: !0
		}), s = t.ownerDocument.documentElement.clientHeight, c = i.closest("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
		await n(c).not.toBeNull(), await n(c.scrollHeight).toBeGreaterThan(c.clientHeight), await n(a.getBoundingClientRect().top).toBeGreaterThan(0), await n(a.getBoundingClientRect().bottom).toBeLessThan(s), await n(o.getBoundingClientRect().bottom).toBeLessThan(s);
		let l = i.lastElementChild;
		await n(l).not.toBeNull(), l?.scrollIntoView({ block: "nearest" }), await n(c.scrollTop).toBeGreaterThan(0), await n(l.getBoundingClientRect().bottom).toBeLessThan(a.getBoundingClientRect().top), await n(a.getBoundingClientRect().top).toBeGreaterThan(0), await n(a.getBoundingClientRect().bottom).toBeLessThan(s);
	}
}, g = {
	args: {},
	render: () => /* @__PURE__ */ s(f, {
		config: {
			...u,
			fields: [{
				...u.fields[0],
				defaultValue: "Ticket body"
			}, u.fields[1]]
		},
		onSubmit: () => new Promise(() => void 0)
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r.ownerDocument.body), a = await i.findByRole("button", {
			name: "Create ticket",
			exact: !0
		});
		await t.click(a), await n(a).toBeDisabled(), await n(i.getByRole("button", {
			name: "Create without opening",
			exact: !0
		})).toBeDisabled();
	}
}, _ = {
	args: {},
	render: () => /* @__PURE__ */ s(f, {
		config: {
			...u,
			fields: [{
				...u.fields[0],
				required: !1
			}, u.fields[1]]
		},
		onSubmit: () => {
			throw Error("Ticket storage is unavailable");
		}
	})
}, v = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: {
		...u,
		fields: []
	} })
}, y = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: u }),
	play: async ({ canvasElement: r }) => {
		let i = e(r.ownerDocument.body);
		await t.type(await i.findByRole("textbox"), "Keep this ticket draft"), await t.click(i.getByRole("button", {
			name: "Cancel",
			exact: !0
		})), await t.click(e(r).getByRole("button", {
			name: "New ticket",
			exact: !0
		})), await n(await i.findByRole("textbox")).toHaveTextContent("Keep this ticket draft");
	}
}, b = {
	args: {},
	render: () => /* @__PURE__ */ s(f, { config: u }),
	play: async ({ canvasElement: r }) => {
		let i = e(r.ownerDocument.body);
		await t.type(await i.findByRole("textbox"), "Choose a creation action"), await t.click(await i.findByRole("button", {
			name: "Create without opening",
			exact: !0
		})), await t.click(await i.findByRole("menuitemradio", {
			name: "Create without opening",
			exact: !0
		})), await n(i.getByRole("dialog")).toBeVisible(), await t.click(i.getByRole("button", {
			name: "Close",
			exact: !0
		})), await t.click(e(r).getByRole("button", {
			name: "New ticket",
			exact: !0
		}));
		let a = i.getAllByRole("button", {
			name: "Create without opening",
			exact: !0
		});
		await n(a).toHaveLength(2), await n(a[0]).toHaveTextContent("Create without opening");
	}
};
export { v as AttributesOnly, p as Empty, h as LongDescription, m as PrefilledFromColumn, b as RememberedCreateAction, y as RetainedDraft, _ as SubmitError, g as Submitting, d as default };
