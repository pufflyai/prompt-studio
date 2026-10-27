// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./full-conversation-normalized-BR4uyFU4.ts";
import { t } from "./ai-message-3J9aywD3.ts";
import { t as n } from "./ai-response-BdnOY5G0.ts";
import { Box as r, Stack as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/ai-message.stories.tsx
var s = e, c = (e) => e.parts?.find((e) => e.type === "text" && "text" in e)?.text, l = s.filter((e) => e.role === "user").map(c).find(Boolean) ?? "No user message available.", u = s.filter((e) => e.role === "assistant").map(c).find((e) => typeof e == "string" && e.length > 0) ?? "No assistant message available.", d = {
	title: "Patterns/Chat/AI Message",
	component: t.Root,
	parameters: { layout: "padded" }
}, f = () => /* @__PURE__ */ a(r, {
	maxW: "960px",
	w: "full",
	borderWidth: "1px",
	borderRadius: "md",
	bg: "bg",
	p: "md",
	children: /* @__PURE__ */ o(i, {
		gap: "sm",
		children: [/* @__PURE__ */ a(t.Root, {
			from: "user",
			children: /* @__PURE__ */ a(t.Content, {
				from: "user",
				children: /* @__PURE__ */ a(n, {
					height: "auto",
					children: l
				})
			})
		}), /* @__PURE__ */ a(t.Root, {
			from: "assistant",
			children: /* @__PURE__ */ a(t.Content, {
				from: "assistant",
				children: /* @__PURE__ */ a(n, {
					height: "auto",
					children: u
				})
			})
		})]
	})
}), p = { render: () => /* @__PURE__ */ a(f, {}) };
export { p as UserAndAssistant, d as default };
