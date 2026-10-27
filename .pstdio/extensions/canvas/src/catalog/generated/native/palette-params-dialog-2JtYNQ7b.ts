// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-workbench-store-BMaFgEbb.ts";
import { t } from "./command-params-dialog-2_Mul3ay.ts";
import { useState as n } from "react";
import { AlertMessage as r, DeleteConfirmationModal as i } from "@pstdio/ui";
import { Fragment as a, jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/palette-params-dialog.tsx
var c = (n) => {
	let { workbench: r, renderParamField: i } = n, c = e(r.commandPalette.store, (e) => e.paramsRequest), u = e(r.commandPalette.store, (e) => e.confirmation);
	return /* @__PURE__ */ s(a, { children: [u ? /* @__PURE__ */ o(l, { confirmation: u }, u.label) : null, /* @__PURE__ */ o(t, {
		request: c,
		renderParamField: i,
		executeOptionCommand: (e, t, n) => r.commands.executeCommand(e, t, {
			...c?.context,
			signal: n
		}),
		prepareArgs: (e) => r.commands.prepareCommandArgs(e.commandId, e.args, e.context, e.onArgsChange),
		onClose: () => r.commandPalette.clearParams(),
		onRun: async ({ commandId: e, args: t, context: n }) => {
			await r.commands.executeCommand(e, t, n);
		}
	})] });
}, l = (e) => {
	let { confirmation: t } = e, [a, s] = n();
	return /* @__PURE__ */ o(i, {
		open: !0,
		headline: `${t.label}?`,
		notificationText: t.description ?? "This cannot be undone.",
		buttonText: t.buttonLabel ?? "Delete",
		onClose: () => t.resolve(!1),
		onDelete: async () => {
			s(void 0);
			try {
				await t.onConfirm?.(), t.resolve(!0);
			} catch (e) {
				throw s(e instanceof Error ? e.message : "Could not save. Try again."), e;
			}
		},
		children: a ? /* @__PURE__ */ o(r, {
			status: "error",
			title: a,
			role: "alert"
		}) : null
	});
};
export { c as n, l as t };
