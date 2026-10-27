// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./triangle-alert-DcqN2fDE.ts";
import { Button as t, HStack as n, Spinner as r, Stack as i, Text as a } from "@chakra-ui/react";
import { AlertMessage as o } from "@pstdio/ui";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/start/components/start-harness-status.tsx
var l = (l) => {
	let { agents: u, isPending: d, isFetching: f, isError: p, onReviewExtensions: m, onCheckAgain: h } = l;
	return d ? /* @__PURE__ */ c(n, {
		gap: "xs",
		color: "fg.muted",
		role: "status",
		children: [/* @__PURE__ */ s(r, { size: "xs" }), /* @__PURE__ */ s(a, {
			textStyle: "paragraph/S/regular",
			children: "Checking agent availability…"
		})]
	}) : p ? /* @__PURE__ */ s(o, {
		status: "error",
		variant: "subtle",
		role: "alert",
		title: "Could not check agent availability",
		children: /* @__PURE__ */ c(i, {
			gap: "xs",
			align: "flex-start",
			children: [/* @__PURE__ */ s(a, { children: "Try checking again. Your tools are still available." }), /* @__PURE__ */ s(t, {
				size: "sm",
				variant: "outline",
				loading: f,
				onClick: h,
				children: "Check again"
			})]
		})
	}) : u.some((e) => e.availability.type === "INSTALLED") ? null : /* @__PURE__ */ s(o, {
		status: "warning",
		variant: "subtle",
		role: "alert",
		title: "No agent available",
		icon: /* @__PURE__ */ s(e, {}),
		children: /* @__PURE__ */ c(i, {
			gap: "xs",
			minW: "0",
			align: "flex-start",
			children: [/* @__PURE__ */ s(a, { children: "You can still use Prompt Studio from your own harness. Sessions within Prompt Studio are unavailable until a harness is available." }), /* @__PURE__ */ s(t, {
				size: "sm",
				variant: "outline",
				onClick: m,
				children: "Browse extensions"
			})]
		})
	});
};
export { l as t };
