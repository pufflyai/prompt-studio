// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./session-chat-notices-CdYc4CZP.ts";
// packages/pstdio-dashboard/src/modules/sessions/components/session-chat-notices.stories.tsx
var t = {
	title: "Sessions/Chat notices",
	component: e,
	args: {
		reconnect: () => {},
		refreshQueue: () => {}
	}
}, n = { args: { unsent: {
	notice: {
		message: "The network is unavailable.",
		temporary: !0
	},
	onRetry: () => {},
	onClose: () => {}
} } }, r = { args: { error: {
	message: "The server had a temporary problem.",
	temporary: !0
} } }, i = { args: { error: {
	message: "This session no longer exists.",
	temporary: !1
} } }, a = { args: { queueError: {
	message: "The server had a temporary problem.",
	temporary: !0
} } };
export { n as MessageNotSent, i as PermanentHistoryError, r as TemporaryHistoryError, a as TemporaryQueueError, t as default };
