// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t, r as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./project-folder-choice-DM6UWdRF.ts";
import { Dialog as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/components/project-folder-choice.stories.tsx
var s = {
	title: "Projects/Project folder",
	component: i,
	decorators: [(e) => /* @__PURE__ */ o(a.Root, {
		open: !0,
		size: "md",
		children: /* @__PURE__ */ o(a.Positioner, { children: /* @__PURE__ */ o(a.Content, { children: /* @__PURE__ */ o(e, {}) }) })
	})],
	args: {
		projectName: "Prompt Studio",
		gitRemote: "git@github.com:pstdio/prompt-studio.git",
		method: "clone",
		clonePath: "~/Projects/prompt-studio",
		pending: !1,
		onMethodChange: n(),
		onClonePathChange: n(),
		onBrowse: n(),
		onNotNow: n(),
		onContinue: n()
	}
}, c = { play: async ({ args: n }) => {
	await e.click(await t.findByRole("button", { name: "Clone and continue" })), await r(n.onContinue).toHaveBeenCalledOnce(), await e.click(t.getByRole("radio", { name: "Use a folder that already has it" })), await r(n.onMethodChange).toHaveBeenCalledWith("existing");
} }, l = { args: { method: "existing" } }, u = { args: {
	gitRemote: null,
	method: "existing",
	clonePath: ""
} }, d = { args: { error: "Could not clone git@github.com:pstdio/prompt-studio.git: Permission denied (publickey)." } };
export { d as CloneFailed, c as CloneRemote, u as NoGitRemote, l as UseExistingFolder, s as default };
