// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, s as t } from "./question-prompt-DIqKf96x.ts";
import { createContext as n, useContext as r, useState as i } from "react";
// packages/ui/src/components/chat-ui/components/chat-question-navigation.tsx
var a = n(void 0), o = () => r(a), s = (n, r) => {
	let [a, o] = i(), s = a?.conversationKey === r ? a : void 0, c = s ? t(n, s.key) : void 0;
	return {
		prompt: c,
		value: {
			activeKey: c ? s?.key : void 0,
			selection: c ? s : void 0,
			open: (t, n) => o((i) => ({
				conversationKey: r,
				key: e(t),
				index: n,
				revision: (i?.revision ?? 0) + 1
			})),
			selectStep: (e) => o((t) => t ? {
				...t,
				index: e
			} : void 0),
			close: () => o(void 0)
		}
	};
};
export { s as n, o as r, a as t };
