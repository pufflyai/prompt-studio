// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./harness-browser-progress-DhS04AjG.ts";
// packages/pstdio-dashboard/src/shared/agents/harness-browser-progress.stories.tsx
var t = {
	title: "Agents/Browser sign-in",
	component: e,
	args: {
		name: "Codex",
		action: "login",
		onCancel: () => {}
	}
}, n = {}, r = { args: { prompt: {
	type: "browser",
	url: "https://auth.openai.com/codex/device",
	code: "TEST-1234"
} } }, i = { args: { prompt: {
	type: "browser",
	url: "https://example.test/login"
} } }, a = { args: { action: "logout" } }, o = { args: {
	question: {
		type: "select",
		title: "Choose a provider",
		initial: "openai",
		options: [{
			id: "openai",
			label: "OpenAI"
		}, {
			id: "anthropic",
			label: "Anthropic"
		}]
	},
	onReply: () => {}
} }, s = { args: {
	question: {
		type: "input",
		title: "OpenAI API key",
		secret: !0
	},
	onReply: () => {}
} };
export { s as ApiKey, i as BrowserLink, r as DeviceCode, o as ProviderChoice, a as SigningOut, n as Starting, t as default };
