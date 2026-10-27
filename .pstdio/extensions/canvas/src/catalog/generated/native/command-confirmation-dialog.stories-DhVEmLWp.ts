// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./palette-params-dialog-2JtYNQ7b.ts";
import { t } from "./workbench-theme-provider-CQSyY8qK.ts";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/command-confirmation-dialog.stories.tsx
var r = {
	title: "pstdio-workbench/Commands/Confirmation",
	component: e,
	decorators: [(e) => /* @__PURE__ */ n(t, { children: /* @__PURE__ */ n(e, {}) })]
}, i = { args: { confirmation: {
	label: "Delete session “Landing page”",
	description: "This cannot be undone. Workspace files and external agent history are kept.",
	buttonLabel: "Delete",
	resolve: () => void 0,
	onConfirm: async () => void 0
} } }, a = { args: { confirmation: {
	label: "Archive session “Landing page”",
	description: "The saved conversation is kept. Queued work will be cancelled.",
	buttonLabel: "Archive",
	resolve: () => void 0,
	onConfirm: async () => void 0
} } }, o = { args: { confirmation: {
	...i.args.confirmation,
	onConfirm: async () => {
		throw Error("Could not save. Try again.");
	}
} } };
export { a as ArchiveQueuedSession, i as DeleteSession, o as RetryFailure, r as default };
