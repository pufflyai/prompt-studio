// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./session-harness-sign-in-CSK1JAVa.ts";
import { t } from "./session-harness-unavailable-kFFTjst0.ts";
import { useState as n } from "react";
import { Box as r } from "@chakra-ui/react";
import { jsx as i } from "react/jsx-runtime";
import { ChatPanel as a } from "@pstdio/ui/chat-ui";
var o = {
	title: "Sessions/Harness access",
	component: (o) => {
		let [s, c] = n(""), { installed: l, signedIn: u } = o, d;
		return l ? u || (d = /* @__PURE__ */ i(e, {
			name: "Codex",
			onLogin: () => {}
		})) : d = /* @__PURE__ */ i(t, { onReviewExtensions: () => {} }), /* @__PURE__ */ i(r, {
			h: "xl",
			children: /* @__PURE__ */ i(a, {
				messages: [],
				emptyStateTitle: "No messages yet",
				emptyStateDescription: "Send a message to start this session.",
				emptyStateContent: d,
				hideComposer: !l,
				chatInputPlaceholder: "Reply to the agent...",
				chatInputDefaultValue: s,
				onChatInputChange: c,
				chatInputCommands: [{
					name: "/login",
					description: "Sign in",
					onSelect: () => {}
				}, {
					name: "/logout",
					description: "Sign out",
					onSelect: () => {}
				}],
				submitDisabled: !u && !/^\/(login|logout)$/.test(s),
				onSubmitMessage: () => c("")
			})
		});
	},
	args: {
		installed: !0,
		signedIn: !1
	}
}, s = {}, c = { args: { installed: !1 } }, l = { args: { signedIn: !0 } }, u = { decorators: [(e) => /* @__PURE__ */ i(r, {
	maxW: "xs",
	children: /* @__PURE__ */ i(e, {})
})] };
export { u as Narrow, c as NoHarness, l as SignedIn, s as SignedOut, o as default };
