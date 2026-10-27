// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./param-editor-387PxPNF.ts";
import { t as r } from "./param-editor-horizontal-CEr38QkA.ts";
import { useState as i } from "react";
import { Box as a, Container as o, HStack as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-control-fixtures.ts
var f = [{
	id: "release-notes",
	file: new File(["# Release notes\n"], "release-notes.md", {
		type: "text/markdown",
		lastModified: 1
	}),
	status: "uploading",
	progress: 62
}, {
	id: "diagram",
	file: new File([/* @__PURE__ */ new Uint8Array(24576)], "diagram.png", {
		type: "image/png",
		lastModified: 2
	}),
	status: "uploading",
	progress: 38
}], p = (e, t) => ({
	param: e,
	defaultValues: t === void 0 ? {} : { [e.id]: t }
}), m = {
	boolean: p({
		id: "notifications",
		name: "Enable notifications",
		type: "boolean",
		description: "Send a notification when processing completes.",
		defaultValue: !0
	}, !0),
	number: p({
		id: "opacity",
		name: "Opacity",
		type: "number",
		description: "Controls the output opacity.",
		defaultValue: 72,
		min: 0,
		max: 100,
		step: 1
	}, 72),
	text: p({
		id: "transform",
		name: "Transform",
		type: "text",
		description: "Runs against each selected item.",
		singleLine: !1,
		defaultValue: "return item.title.trim();"
	}, "return item.title.trim();"),
	markdown: p({
		id: "release-notes",
		name: "Release notes",
		type: "markdown",
		description: "Rich Markdown editing.",
		placeholder: "Describe this release...",
		defaultValue: "# Release notes\n\nThis release improves parameter editor parity.\n\n- [x] Shared controls"
	}, "# Release notes\n\nThis release improves parameter editor parity.\n\n- [x] Shared controls"),
	selection: p({
		id: "role",
		name: "Role",
		type: "selection",
		description: "Select a role.",
		defaultValue: "assistant",
		options: [
			{
				id: "user",
				name: "User",
				icon: "user"
			},
			{
				id: "assistant",
				name: "Assistant",
				icon: "code"
			},
			{
				id: "system",
				name: "System",
				icon: "component"
			}
		]
	}, "assistant"),
	longSelection: p({
		id: "topics",
		name: "Topics",
		type: "selection",
		multiSelect: !0,
		allowCustomValues: !0,
		defaultValue: [],
		options: [
			{
				id: "manage several coding agents",
				name: "manage several coding agents"
			},
			{
				id: "internal tools with Claude Code",
				name: "internal tools with Claude Code"
			},
			{
				id: "agent workbench",
				name: "agent workbench"
			}
		]
	}, [
		"manage several coding agents",
		"internal tools with Claude Code",
		"agent workbench"
	]),
	date: p({
		id: "publish-date",
		name: "Publish date",
		type: "date",
		description: "Target publication date.",
		defaultValue: "2026-07-30",
		min: "2026-01-01",
		max: "2026-12-31"
	}, "2026-07-30"),
	dateReadOnly: p({
		id: "created-at",
		name: "Created at",
		type: "date",
		readOnly: !0,
		defaultValue: "2026-10-05T22:05:00.000Z"
	}, "2026-10-05T22:05:00.000Z"),
	color: p({
		id: "tint",
		name: "Tint",
		type: "color",
		description: "Primary output color.",
		defaultValue: "#0c8ce9"
	}, "#0c8ce9"),
	property: p({
		id: "version",
		name: "Version",
		type: "property",
		description: "Current package version.",
		value: "1.4.0"
	}),
	readOnly: p({
		id: "verified",
		name: "Verified",
		type: "readOnly",
		description: "Serializable display-only value.",
		value: !0
	}),
	resource: p({
		id: "labels",
		name: "Labels",
		type: "resource",
		description: "Resources rendered using the tag primitive.",
		editable: !0,
		multiSelect: !0,
		placeholder: "Add label",
		defaultValue: ["bug", "docs"],
		options: [
			{
				id: "bug",
				name: "Bug",
				icon: "bug",
				color: "red"
			},
			{
				id: "feature",
				name: "Feature",
				icon: "sparkles",
				color: "purple"
			},
			{
				id: "docs",
				name: "Docs",
				icon: "book-open",
				color: "blue"
			}
		]
	}, ["bug", "docs"]),
	reference: p({
		id: "references",
		name: "References",
		type: "resource",
		description: "Resources that open in their owning surface.",
		multiSelect: !0,
		defaultValue: ["ticket", "pull-request"],
		options: [{
			id: "ticket",
			name: "PS-42",
			icon: "ticket",
			ref: {
				type: "ticket",
				id: "PS-42"
			}
		}, {
			id: "pull-request",
			name: "PR #7",
			icon: "git-pull-request",
			href: "https://example.com/pull/7"
		}]
	}, ["ticket", "pull-request"]),
	range: p({
		id: "trim",
		name: "Trim",
		type: "range",
		description: "Select the visible interval.",
		defaultValue: [12, 84],
		min: 0,
		max: 100,
		step: 1,
		unit: "%"
	}, [12, 84]),
	segmented: p({
		id: "quality",
		name: "Quality",
		type: "segmented",
		description: "Select one output mode.",
		defaultValue: "balanced",
		options: [
			{
				id: "draft",
				name: "Draft"
			},
			{
				id: "balanced",
				name: "Balanced"
			},
			{
				id: "detailed",
				name: "Detailed"
			}
		]
	}, "balanced"),
	actions: p({
		id: "align",
		name: "Align",
		type: "actions",
		description: "Apply an alignment command.",
		options: [
			{
				id: "left",
				name: "Left"
			},
			{
				id: "center",
				name: "Center"
			},
			{
				id: "right",
				name: "Right"
			},
			{
				id: "justify",
				name: "Justify",
				disabled: !0
			}
		]
	}),
	anchorGrid: p({
		id: "anchor",
		name: "Anchor",
		type: "anchorGrid",
		description: "Select an anchor position.",
		defaultValue: "center"
	}, "center"),
	vector: p({
		id: "offset",
		name: "Offset",
		type: "vector",
		description: "Cartesian x/y offset.",
		defaultValue: {
			x: 0,
			y: 0
		},
		xLabel: "X",
		yLabel: "Y",
		min: -100,
		max: 100,
		step: 1
	}, {
		x: 0,
		y: 0
	}),
	fileUpload: p({
		id: "attachments",
		name: "Attachments",
		type: "fileUpload",
		description: "Queued files and host-controlled upload status.",
		uploadLabel: "Attach files",
		multiple: !0,
		defaultValue: f
	}, f)
}, h = (e) => {
	let { fixture: t } = e, [f, p] = i(t.defaultValues), m = {
		params: [t.param],
		defaultValues: f,
		onChange: (e, t) => p((n) => ({
			...n,
			[e]: t
		})),
		onOpenResource: () => {}
	};
	return /* @__PURE__ */ u(o, {
		padding: "md",
		maxWidth: "none",
		children: /* @__PURE__ */ d(c, {
			gap: "lg",
			children: [/* @__PURE__ */ d(c, {
				gap: "xs",
				children: [/* @__PURE__ */ u(l, {
					textStyle: "label/S/medium",
					children: "Vertical"
				}), /* @__PURE__ */ u(a, {
					maxWidth: "360px",
					borderWidth: "1px",
					borderColor: "border.subtle",
					borderRadius: "xs",
					bg: "bg.subtle",
					overflow: "hidden",
					children: /* @__PURE__ */ u(n, { ...m })
				})]
			}), t.param.type === "anchorGrid" ? null : /* @__PURE__ */ d(c, {
				gap: "xs",
				children: [/* @__PURE__ */ u(l, {
					textStyle: "label/S/medium",
					children: "Horizontal"
				}), /* @__PURE__ */ u(s, {
					minHeight: "4rem",
					alignItems: "start",
					children: /* @__PURE__ */ u(r, { ...m })
				})]
			})]
		})
	});
}, g = {
	title: "Patterns/Param Editor",
	parameters: { layout: "fullscreen" }
}, _ = (e) => ({ render: () => /* @__PURE__ */ u(h, { fixture: e }) }), v = _(m.boolean), y = _(m.number), b = {
	..._(m.text),
	play: async ({ canvasElement: n }) => {
		let r = e(n).getAllByRole("textbox", { name: m.text.param.name });
		await t(r).toHaveLength(2);
		for (let n of r) {
			await t(n.tagName).toBe("TEXTAREA");
			let r = n.parentElement;
			if (!r) throw Error("Text field is missing its container");
			let i = e(r).getByText(m.text.param.name);
			await t(i.getBoundingClientRect().bottom).toBeLessThanOrEqual(n.getBoundingClientRect().top), await t(n.getBoundingClientRect().width).toBe(r.getBoundingClientRect().width);
		}
	}
}, x = _(m.markdown), S = _(m.selection), C = {
	..._(m.longSelection),
	play: async ({ canvasElement: n }) => {
		let r = e(n), [i] = r.getAllByText("Topics"), [a] = r.getAllByRole("button", { name: /manage several coding agents/ });
		await t(i.getBoundingClientRect().width).toBeGreaterThan(30), await t(a.getBoundingClientRect().width).toBeLessThan(360);
	}
}, w = _(m.date), T = _(m.dateReadOnly), E = _(m.color), D = _(m.property), O = _(m.readOnly), k = _(m.resource), A = _(m.reference), j = _(m.range), M = _(m.segmented), N = _(m.actions), P = _(m.anchorGrid), F = _(m.vector), I = _(m.fileUpload);
export { N as InputActions, P as InputAnchorGrid, v as InputBoolean, E as InputColor, w as InputDate, T as InputDateReadOnly, I as InputFileUpload, x as InputMarkdown, y as InputNumber, D as InputProperty, j as InputRange, O as InputReadOnly, A as InputReference, k as InputResource, M as InputSegmented, S as InputSelection, C as InputSelectionLongValues, b as InputText, F as InputVector, g as default };
