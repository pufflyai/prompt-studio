// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useState as e } from "react";
import { Button as t, Stack as n } from "@chakra-ui/react";
import { AlertMessage as r } from "@pstdio/ui";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/session-chat-notices.tsx
var o = (e) => {
	let { notice: n, title: a, onRetry: o, onClose: s } = e;
	return /* @__PURE__ */ i(r, {
		status: "error",
		title: a,
		onClose: s,
		endElement: n.temporary ? /* @__PURE__ */ i(t, {
			onClick: o,
			children: "Retry"
		}) : void 0,
		children: n.message
	});
}, s = (t) => {
	let { error: r, queueError: s, reconnect: c, refreshQueue: l, unsent: u } = t, [d, f] = e([]), p = (e) => e && !d.includes(e.message), m = (e) => () => f((t) => [...t, e.message]);
	return !u && !p(r) && !p(s) ? null : /* @__PURE__ */ a(n, {
		gap: "xs",
		pb: "sm",
		children: [
			u ? /* @__PURE__ */ i(o, {
				title: "Message not sent",
				notice: u.notice,
				onRetry: u.onRetry,
				onClose: u.onClose
			}) : null,
			r && p(r) ? /* @__PURE__ */ i(o, {
				title: "Could not load conversation",
				notice: r,
				onRetry: c,
				onClose: m(r)
			}) : null,
			s && p(s) ? /* @__PURE__ */ i(o, {
				title: "Could not update queued prompts",
				notice: s,
				onRetry: l,
				onClose: m(s)
			}) : null
		]
	});
};
export { s as t };
