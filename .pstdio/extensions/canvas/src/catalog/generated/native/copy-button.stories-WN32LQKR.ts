// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./copy-button-BuvxTT0_.ts";
import { Stack as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/primitives/copy-button.stories.tsx
var a = {
	title: "Components/Inputs/CopyButton",
	component: e,
	args: { text: "Build the tools that make your work easier." },
	parameters: { docs: { description: { component: "Copies exact text and briefly shows Copied or a retry message. Pass a function as text to read changing content at click time. Extension webviews must declare clipboard.write." } } }
}, o = {}, s = {
	args: {
		label: "Copy draft",
		text: "I built a daily research tool in Prompt Studio.\n\nIt finds useful conversations and suggests replies."
	},
	render: (a) => /* @__PURE__ */ i(t, {
		gap: "sm",
		children: [/* @__PURE__ */ r(n, {
			textStyle: "paragraph/S/regular",
			whiteSpace: "pre-wrap",
			children: typeof a.text == "function" ? a.text() : a.text
		}), /* @__PURE__ */ r(e, { ...a })]
	})
}, c = { args: { disabled: !0 } }, l = { args: { text: "" } };
export { o as Default, c as Disabled, s as Draft, l as Empty, a as default };
