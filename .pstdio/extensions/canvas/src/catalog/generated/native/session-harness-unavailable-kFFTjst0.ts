// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./square-CKYOWRAv.ts";
import { t } from "./triangle-alert-DcqN2fDE.ts";
import { t as n } from "./useTranslation-DvWg4zeU.ts";
import { Button as r, HStack as i, Icon as a, IconButton as o } from "@chakra-ui/react";
import { EmptyState as s } from "@pstdio/ui";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/session-harness-unavailable.tsx
var u = (u) => {
	let { onReviewExtensions: d, onInterrupt: f } = u, { t: p } = n("projects");
	return /* @__PURE__ */ c(s, {
		title: p("harnessAccount.noHarnessTitle"),
		description: p("harnessAccount.noHarnessDescription"),
		icon: /* @__PURE__ */ c(a, {
			as: t,
			color: "fg.warning",
			boxSize: "12"
		}),
		children: /* @__PURE__ */ l(i, {
			gap: "2xs",
			children: [/* @__PURE__ */ c(r, {
				size: "2xs",
				variant: "outline",
				onClick: d,
				children: p("harnessAccount.extensions")
			}), f ? /* @__PURE__ */ c(o, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Stop session",
				onClick: f,
				children: /* @__PURE__ */ c(e, {})
			}) : null]
		})
	});
};
export { u as t };
