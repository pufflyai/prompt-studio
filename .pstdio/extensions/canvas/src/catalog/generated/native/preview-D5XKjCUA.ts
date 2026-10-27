// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { ChakraProvider as e, createSystem as t, defineConfig as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
import { psTheme as i } from "@pstdio/ui/theme";
// clients/landing-page/src/theme/theme.ts
var a = n({ theme: { tokens: { colors: { illustration: {
	desktop: { value: "#FF6B1A" },
	page: { value: "#29ABE2" },
	command: { value: "#FBB040" },
	editor: { value: "#29ABE2" },
	skill: { value: "#E6357F" },
	hook: { value: "#E6357F" },
	automation: { value: "#F7931E" }
} } } } }), o = t(i._config, a), s = ({ children: t }) => /* @__PURE__ */ r(e, {
	value: o,
	children: t
}), c = { decorators: [(e) => /* @__PURE__ */ r(s, { children: /* @__PURE__ */ r(e, {}) })] };
export { c as default };
