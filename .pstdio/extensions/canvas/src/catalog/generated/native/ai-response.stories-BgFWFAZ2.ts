// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./full-conversation-normalized-BR4uyFU4.ts";
import { t } from "./ai-response-BdnOY5G0.ts";
// packages/ui/src/components/chat-ui/components/ai-response.stories.tsx
var n = e, r = (e) => e.parts?.find((e) => e.type === "text" && "text" in e)?.text, i = n.filter((e) => e.role === "user").map(r).find(Boolean) ?? "No user message available.", a = n.filter((e) => e.role === "assistant").map(r).find((e) => typeof e == "string" && e.length > 0) ?? "No assistant message available.", o = {
	title: "Patterns/Chat/AI Response",
	component: t,
	parameters: { layout: "padded" }
}, s = { args: {
	children: a,
	height: "auto"
} }, c = { args: {
	children: i,
	height: "auto"
} };
export { s as AssistantResponse, c as UserPromptAsContent, o as default };
