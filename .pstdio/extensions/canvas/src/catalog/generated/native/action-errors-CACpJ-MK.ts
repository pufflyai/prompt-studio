// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-workbench-store-BMaFgEbb.ts";
import { useEffect as t } from "react";
import { Box as n } from "@chakra-ui/react";
import { AlertMessage as r } from "@pstdio/ui";
import { jsx as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/notifications/action-errors.tsx
var a = (a) => {
	let { workbench: o, target: s } = a, c = e(o.notifications.store, (e) => e.notifications), l = Object.values(c).filter((e) => e.inlineTarget === s);
	return t(() => () => {
		for (let e of o.notifications.listNotifications()) e.inlineTarget === s && o.notifications.dismiss(e.id);
	}, [o, s]), l.length ? /* @__PURE__ */ i(n, {
		flexShrink: 0,
		p: "xs",
		"data-action-error-target": s,
		children: l.map((e) => /* @__PURE__ */ i(r, {
			status: "error",
			role: "alert",
			title: e.title,
			onClose: () => o.notifications.dismiss(e.id),
			children: e.message
		}, e.id))
	}) : null;
};
export { a as t };
