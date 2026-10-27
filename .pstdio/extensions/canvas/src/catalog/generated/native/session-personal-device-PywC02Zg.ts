// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./monitor-DduF09pA.ts";
import { AlertMessage as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/session-personal-device.tsx
var r = (r) => {
	let { name: i } = r;
	return /* @__PURE__ */ n(t, {
		status: "info",
		title: `Session on ${i}`,
		icon: /* @__PURE__ */ n(e, {}),
		children: "You can read this conversation here. Continue it on its device."
	});
};
export { r as t };
