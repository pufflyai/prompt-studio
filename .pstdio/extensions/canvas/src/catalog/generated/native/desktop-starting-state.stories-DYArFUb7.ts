// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./desktop-starting-state-wFsx3atB.ts";
// clients/desktop/src/renderer/desktop-starting-state.stories.tsx
var t = {
	title: "Patterns/Desktop/Startup progress",
	component: e,
	parameters: { layout: "centered" },
	args: { phase: "database" }
}, n = {}, r = { args: { phase: "retiring" } }, i = { args: {
	phase: "retiring",
	takingLonger: !0
} }, a = { args: { phase: "extensions" } }, o = { args: {
	phase: "database",
	takingLonger: !0
} };
export { r as BackingUpPreviousData, i as BackupTakingLonger, a as LoadingTools, n as PreparingData, o as TakingLonger, t as default };
