// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extension-settings-form-CPEAyYcV.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-settings-form.stories.tsx
var r = [
	{
		key: "implementation.adversarialReview",
		extensionId: "pstdio.pstdio-planner",
		type: "boolean",
		scope: "project",
		default: !0,
		title: "Adversarial review",
		description: "Run an adversarial review before finishing ticket implementation.",
		value: !0,
		source: "default"
	},
	{
		key: "automation.maxInProgress",
		extensionId: "pstdio.pstdio-planner",
		type: "number",
		scope: "project",
		default: 2,
		title: "Maximum in-progress tickets",
		value: 2,
		source: "default"
	},
	{
		key: "implementation.defaultTargetBranch",
		extensionId: "pstdio.pstdio-planner",
		type: "string",
		scope: "project",
		default: "",
		title: "Default target branch",
		description: "Remote branch that new work targets. Clear it to use the repository default branch.",
		options: {
			commandId: "pstdio.pstdio-planner.command.implementation-targets",
			valueField: "branch",
			labelField: "branch"
		},
		value: "origin/main",
		source: "stored"
	}
], i = {
	title: "ProjectSettings/ExtensionSettingsForm",
	component: e,
	decorators: [(e) => /* @__PURE__ */ n(t, {
		maxW: "xl",
		p: "lg",
		children: /* @__PURE__ */ n(e, {})
	})],
	args: {
		settings: r,
		executeOptionCommand: async () => [
			{ branch: "origin/main" },
			{ branch: "origin/release/next" },
			{ branch: "origin/hotfix" }
		],
		onChangeSetting: () => {}
	}
}, a = {}, o = { args: { executeOptionCommand: () => new Promise(() => {}) } }, s = { args: { executeOptionCommand: async () => {
	throw Error("Could not list remote branches.");
} } }, c = { args: { settings: r.map((e) => e.key === "implementation.defaultTargetBranch" ? {
	...e,
	value: "origin/release/old"
} : e) } }, l = { args: { executeOptionCommand: async () => [] } };
export { a as Loaded, o as LoadingOptions, l as NoOptions, s as OptionsFailed, c as SavedValueNotListed, i as default };
