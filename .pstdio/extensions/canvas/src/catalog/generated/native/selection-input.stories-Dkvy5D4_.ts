// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./selection-input-C8HKweBU.ts";
// packages/ui/src/components/param-editor/inputs/selection-input.stories.tsx
var a = {
	id: "main",
	name: "main",
	icon: "git-commit-horizontal"
}, o = {
	id: "develop",
	name: "develop",
	icon: "git-commit-horizontal"
}, s = {
	title: "Patterns/Param Editor/Selection",
	component: i,
	args: {
		id: "base",
		name: "Base branch",
		description: "",
		defaultValue: "main",
		options: [a, o],
		onChange: () => {}
	}
}, c = {
	tags: ["menu-selection"],
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await n.click(a.getByRole("button", { name: "main" }));
		let s = o.getByRole("menuitemradio", { name: "main" });
		await r(s).toBeChecked(), r(getComputedStyle(s).backgroundColor).toBe("rgba(0, 0, 0, 0)"), r(s.querySelector(".lucide-check")).not.toBeNull(), await t(() => r(o.getByRole("menu")).toHaveFocus()), await n.keyboard("{Home}{ArrowDown}{Enter}"), await t(() => r(a.getByRole("button", { name: "develop" })).toBeVisible());
	}
}, l = { args: {
	id: "status",
	name: "Eligible statuses",
	defaultValue: ["todo"],
	multiSelect: !0,
	searchable: !0,
	options: [
		{
			id: "todo",
			name: "Todo",
			icon: "status-todo",
			color: "gray"
		},
		{
			id: "building",
			name: "Building",
			icon: "status-progress",
			color: "blue"
		},
		{
			id: "done",
			name: "Delivered",
			icon: "status-done",
			color: "green"
		}
	]
} }, u = {
	args: { options: [a] },
	play: async ({ canvasElement: t }) => {
		await r(e(t).getByRole("button", { name: "main" })).toBeDisabled();
	}
}, d = { args: {
	id: "effort",
	name: "Reasoning effort",
	defaultValue: "medium",
	options: [
		{
			id: "low",
			name: "Low",
			icon: "level-low"
		},
		{
			id: "medium",
			name: "Medium",
			icon: "level-mid"
		},
		{
			id: "high",
			name: "High",
			icon: "level-high"
		},
		{
			id: "xhigh",
			name: "Extra high",
			icon: "level-xhigh"
		}
	]
} }, f = {
	args: {
		options: [],
		defaultValue: ""
	},
	play: async ({ canvasElement: t }) => {
		await r(e(t).getByRole("button", { name: "Select" })).toBeDisabled();
	}
}, p = {
	args: {
		options: [a],
		defaultValue: ""
	},
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", { name: "Select" })), await n.click(a.getByRole("menuitemradio", { name: "main" })), await r(i.getByRole("button", { name: "main" })).toBeDisabled();
	}
}, m = {
	args: {
		options: [a],
		clearable: !0
	},
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", { name: "main" })), await n.click(a.getByRole("menuitemradio", { name: "main" })), await r(i.getByRole("button", { name: "Select" })).toBeEnabled();
	}
}, h = {
	tags: ["menu-selection"],
	args: {
		options: [a],
		defaultValue: ["main"],
		multiSelect: !0
	},
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", { name: "main" })), await n.click(a.getByRole("menuitemcheckbox", { name: "main" })), await r(i.getByRole("button", { name: "Select" })).toBeEnabled();
	}
}, g = {
	args: {
		options: [a, {
			...o,
			disabled: !0
		}],
		searchable: !0
	},
	play: u.play
}, _ = {
	args: {
		options: [{
			...a,
			disabled: !0
		}],
		defaultValue: "",
		clearable: !0
	},
	play: f.play
}, v = { args: {
	options: [{
		id: "main",
		name: "main"
	}, {
		id: "develop",
		name: "develop"
	}],
	searchable: !0
} }, y = {
	id: "repository",
	name: "Repository",
	defaultValue: "app",
	options: [{
		id: "app",
		name: "App",
		icon: "folder"
	}, {
		id: "docs",
		name: "Docs",
		icon: "folder"
	}]
}, b = {
	args: {
		options: [a],
		group: y
	},
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.click(i.getByRole("button", { name: "main" })), await n.click(a.getByRole("menuitem", { name: "Repository" })), await n.click(a.getByRole("menuitem", { name: "Docs" })), await r(i.getByRole("button", { name: "main" })).toBeEnabled();
	}
}, x = { args: {
	options: [],
	defaultValue: "",
	group: y
} }, S = {
	args: {
		options: [a],
		group: {
			...y,
			options: [y.options[0], {
				...y.options[1],
				disabled: !0
			}]
		}
	},
	play: u.play
}, C = { args: {
	options: [],
	defaultValue: "",
	group: {
		...y,
		options: [y.options[0]],
		defaultValue: ""
	}
} }, w = { args: {
	allowCustomValues: !0,
	multiSelect: !0,
	defaultValue: ["custom,value"],
	options: [a, o]
} };
export { _ as AllOptionsUnavailable, c as BranchChoices, b as ChangeGroup, w as CustomChoices, d as EffortLevels, x as EmptyGroup, v as IconlessChoices, h as MultiSelection, f as NoOptions, u as OnlySelectedOption, C as OnlyUnsetGroup, p as OnlyUnsetOption, m as OptionalSelection, l as StatusChoices, g as UnavailableAlternatives, S as UnavailableGroups, s as default };
