// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useState as e } from "react";
import { AlertMessage as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/components/use-action-error.tsx
var r = () => {
	let [r, i] = e(), a = () => i(void 0);
	return {
		showError: i,
		clearError: a,
		errorNotice: r ? /* @__PURE__ */ n(t, {
			status: "error",
			role: "alert",
			title: r.title,
			onClose: a,
			children: r.description
		}) : null
	};
};
export { r as t };
