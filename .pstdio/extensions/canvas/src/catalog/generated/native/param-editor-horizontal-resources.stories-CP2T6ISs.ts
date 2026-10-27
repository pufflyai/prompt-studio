// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-horizontal-Dbh-6IOS.ts";
import { Container as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-horizontal-resources.stories.tsx
var r = {
	id: "labels",
	name: "Labels",
	type: "resource",
	description: "Editable labels use compact chips.",
	editable: !0,
	multiSelect: !0,
	placeholder: "Add label",
	defaultValue: ["bug", "docs"],
	options: [
		{
			id: "bug",
			name: "Bug"
		},
		{
			id: "docs",
			name: "Docs"
		},
		{
			id: "feature",
			name: "Feature"
		}
	]
}, i = {
	id: "references",
	name: "References",
	type: "resource",
	description: "References open their owning resource.",
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
}, a = [{
	id: "brief",
	file: new File([/* @__PURE__ */ new Uint8Array(131072)], "brief.pdf", {
		type: "application/pdf",
		lastModified: 1
	}),
	status: "complete"
}], o = [
	{
		id: "automation",
		title: "Automation",
		params: [{
			id: "automation",
			name: "Automation",
			type: "boolean",
			defaultValue: !0
		}]
	},
	{
		id: "trim",
		title: "Trim",
		params: [{
			id: "trim",
			name: "Trim",
			type: "range",
			defaultValue: [12, 84],
			min: 0,
			max: 100,
			unit: "%"
		}]
	},
	{
		id: "attachment",
		title: "Attachment",
		params: [{
			id: "attachment",
			name: "Attachment",
			type: "fileUpload",
			uploadLabel: "Attach files",
			defaultValue: a
		}]
	}
], s = {
	title: "Patterns/Param Editor/Param Editor Horizontal",
	component: e,
	parameters: { layout: "fullscreen" }
}, c = {
	render: (r) => /* @__PURE__ */ n(t, {
		padding: "md",
		maxWidth: "none",
		children: /* @__PURE__ */ n(e, { ...r })
	}),
	args: {
		params: [r, i],
		groups: o,
		defaultValues: {
			labels: ["bug", "docs"],
			references: ["ticket", "pull-request"],
			automation: !0,
			trim: [12, 84],
			attachment: a
		},
		onChange: () => {},
		onOpenResource: () => {}
	}
};
export { c as ResourceControls, s as default };
