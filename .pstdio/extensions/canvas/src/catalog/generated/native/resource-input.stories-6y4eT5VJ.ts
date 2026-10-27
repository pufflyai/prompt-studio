// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./param-editor-387PxPNF.ts";
import { Container as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/resource-input.stories.tsx
var s = {
	id: "status",
	name: "Status",
	type: "resource",
	editable: !0,
	defaultValue: "in-progress",
	options: [
		{
			id: "todo",
			name: "To do",
			icon: "circle",
			color: "gray"
		},
		{
			id: "in-progress",
			name: "In progress",
			icon: "clock",
			color: "blue"
		},
		{
			id: "done",
			name: "Done",
			icon: "check-circle",
			color: "green"
		}
	]
}, c = {
	id: "priority",
	name: "Priority",
	type: "resource",
	editable: !0,
	multiSelect: !0,
	placeholder: "Add priority",
	defaultValue: ["high"],
	options: [
		{
			id: "low",
			name: "Low",
			icon: "flag",
			color: "gray"
		},
		{
			id: "high",
			name: "High",
			icon: "flame",
			color: "orange"
		},
		{
			id: "urgent",
			name: "Urgent",
			icon: "alert-triangle",
			color: "red"
		}
	]
}, l = {
	id: "id",
	name: "ID",
	type: "resource",
	emptyText: "None",
	defaultValue: "PS-42",
	options: [{
		id: "PS-42",
		name: "PS-42",
		icon: "circle",
		copyText: "PS-42"
	}]
}, u = {
	id: "depends-on",
	name: "Depends on",
	type: "resource",
	multiSelect: !0,
	emptyText: "None",
	defaultValue: ["PS-1", "PS-2"],
	options: [{
		id: "PS-1",
		name: "PS-1",
		icon: "circle",
		ref: {
			type: "ticket",
			id: "PS-1"
		}
	}, {
		id: "PS-2",
		name: "PS-2",
		icon: "circle",
		ref: {
			type: "ticket",
			id: "PS-2"
		}
	}]
}, d = {
	id: "review-links",
	name: "Review links",
	type: "resource",
	multiSelect: !0,
	emptyText: "None",
	defaultValue: ["pr-42"],
	options: [{
		id: "pr-42",
		name: "PR #42",
		icon: "code",
		href: "https://example.com/pr/42"
	}]
}, f = {
	title: "Components/Inputs/Param Editor/Resource Input",
	component: i,
	parameters: { layout: "fullscreen" }
}, p = {
	render: (e) => /* @__PURE__ */ o(a, {
		padding: "md",
		maxW: "sm",
		children: /* @__PURE__ */ o(i, { ...e })
	}),
	args: {
		fullWidth: !0,
		onChange: () => {},
		onOpenResource: () => {},
		params: [
			l,
			s,
			c,
			u,
			d
		]
	}
}, m = {
	...p,
	tags: ["!manifest"],
	args: {
		params: [{
			...c,
			defaultValue: []
		}],
		onChange: e()
	},
	play: async ({ canvasElement: e, args: i }) => {
		let a = t(e);
		await n.click(a.getByRole("button", { name: "Add priority" })), await n.click(t(document.body).getByRole("menuitemcheckbox", { name: /^High$/ })), await r(i.onChange).toHaveBeenLastCalledWith("priority", ["high"]), await n.click(t(document.body).getByRole("menuitemcheckbox", { name: /^Urgent$/ })), await r(i.onChange).toHaveBeenLastCalledWith("priority", ["high", "urgent"]), await n.click(t(document.body).getByRole("menuitemcheckbox", { name: /^High$/ })), await r(i.onChange).toHaveBeenLastCalledWith("priority", ["urgent"]);
	}
};
export { p as Demo, m as ImmediateMultiSelectChanges, f as default };
