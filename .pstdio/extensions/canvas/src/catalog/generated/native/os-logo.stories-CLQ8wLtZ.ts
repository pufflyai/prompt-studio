// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./os-logo-B73pD8nu.ts";
import { HStack as n, Icon as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// clients/landing-page/src/components/icons/os-logo.stories.tsx
var s = {
	title: "Landing/OS logos",
	component: t,
	args: { platform: "macOS" },
	parameters: { layout: "centered" }
}, c = {}, l = { args: { platform: "Windows" } }, u = { args: { platform: "Linux" } }, d = { render: () => /* @__PURE__ */ a(n, {
	gap: "lg",
	children: [
		"macOS",
		"Windows",
		"Linux"
	].map((t) => /* @__PURE__ */ o(n, {
		gap: "xs",
		children: [/* @__PURE__ */ a(r, {
			as: e(t),
			boxSize: "icon-sm"
		}), /* @__PURE__ */ a(i, {
			textStyle: "label/S/regular",
			children: t
		})]
	}, t))
}) };
export { d as DownloadPlatforms, u as Linux, c as MacOS, l as Windows, s as default };
