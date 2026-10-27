// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { SkillViewerContent as e } from "./skill-viewer-CHuqOXjC.ts";
import { FileIconThemePreferenceProvider as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/skill-viewer.stories.tsx
var r = {
	title: "ProjectSettings/SkillViewer",
	component: e,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ n(t, { children: /* @__PURE__ */ n("div", {
		style: { height: "640px" },
		children: /* @__PURE__ */ n(e, {})
	}) })]
}, i = {
	deleted_at: null,
	id: "skill-1",
	project_id: "project-1",
	name: "create-ticket",
	title: "Create Ticket",
	description: "Create planner tickets from a short request.",
	source_kind: "extension",
	files: [{
		path: "SKILL.md",
		content: "---\nmetadata:\n  version: 1.2.0\n---\n\n# Create Ticket\n",
		encoding: "utf8"
	}, {
		path: "references/examples.md",
		content: "# Examples\n",
		encoding: "utf8"
	}],
	editable: !0,
	extension_instance_id: "extension-instance-1",
	extension_id: "pstdio.planner",
	installed_extension_id: "installed-extension-1",
	install_name: "pstdio-planner",
	key: "createTicket",
	enabled: !0,
	installed_agents: ["pstdio.harness-claude-code.harness.claude-code", "pstdio.harness-codex.harness.codex"],
	agent_installations: [],
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z"
}, a = (e, t) => ({
	agent_id: e,
	agent_name: t,
	installed_version: "1.2.0"
}), o = { args: { skill: {
	...i,
	agent_installations: [a("pstdio.harness-claude-code.harness.claude-code", "claude-code"), a("pstdio.harness-codex.harness.codex", "codex")]
} } }, s = { args: { skill: {
	...i,
	installed_agents: [],
	agent_installations: []
} } };
export { o as InstalledExtensionSkill, s as NotInstalledSkill, r as default };
