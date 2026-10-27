// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./square-CKYOWRAv.ts";
import { t } from "./triangle-alert-DcqN2fDE.ts";
import { Button as n, HStack as r, IconButton as i } from "@chakra-ui/react";
import { AlertMessage as a } from "@pstdio/ui";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/session-harness-unavailable.tsx
var c = (c) => {
	let { onReviewExtensions: l, onInterrupt: u } = c;
	return /* @__PURE__ */ o(a, {
		status: "warning",
		role: "alert",
		title: "No agent available",
		icon: /* @__PURE__ */ o(t, {}),
		endElement: /* @__PURE__ */ s(r, {
			gap: "2xs",
			children: [/* @__PURE__ */ o(n, {
				size: "2xs",
				variant: "outline",
				onClick: l,
				children: "Browse extensions"
			}), u ? /* @__PURE__ */ o(i, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Stop session",
				onClick: u,
				children: /* @__PURE__ */ o(e, {})
			}) : null]
		})
	});
};
export { c as t };
