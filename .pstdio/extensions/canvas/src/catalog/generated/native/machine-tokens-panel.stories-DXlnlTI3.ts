// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./machine-tokens-panel-Cqp8uXSn.ts";
// packages/pstdio-dashboard/src/modules/settings/components/machine-tokens-panel.stories.tsx
var t = {
	title: "ProjectSettings/MachineTokensPanel",
	component: e,
	parameters: { layout: "padded" }
}, n = { args: {
	tokens: [{
		id: "token-1",
		principalId: "principal-1",
		name: "Notion launcher",
		tokenPrefix: "pst_at_018f",
		projectId: "project-1",
		commandScopes: ["pstdio.planner.command.start-attempt"],
		expiresAt: "2026-09-25T08:00:00.000Z",
		lastUsedAt: "2026-08-26T08:00:00.000Z",
		revokedAt: null,
		createdAt: "2026-08-26T07:00:00.000Z"
	}],
	issuedToken: "pst_at_018f_shown-once",
	name: "",
	scopes: "",
	expiresInDays: "30",
	onNameChange: () => {},
	onScopesChange: () => {},
	onExpiresInDaysChange: () => {},
	onIssue: () => {},
	onRevoke: () => {},
	onCopy: () => {}
} };
export { n as ActiveToken, t as default };
