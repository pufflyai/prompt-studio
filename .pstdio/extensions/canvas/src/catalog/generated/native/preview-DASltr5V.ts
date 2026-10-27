// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./config-BXc93cB9.ts";
import { t } from "./context-CWGGhs3p.ts";
import { createElement as n, useMemo as r } from "react";
import { ChakraProvider as i, psTheme as a } from "@pstdio/ui";
import { jsx as o } from "react/jsx-runtime";
import "@pstdio/ui/style.css";
// node_modules/.bun/react-i18next@16.5.8+d976778d4c9f401e/node_modules/react-i18next/dist/es/I18nextProvider.js
function s({ i18n: e, defaultNS: i, children: a }) {
	let o = r(() => ({
		i18n: e,
		defaultNS: i
	}), [e, i]);
	return n(t.Provider, { value: o }, a);
}
// packages/pstdio-dashboard/.storybook/preview.tsx
var c = {
	parameters: { controls: { matchers: {
		color: /(background|color)$/i,
		date: /Date$/i
	} } },
	decorators: [(t) => /* @__PURE__ */ o(s, {
		i18n: e,
		children: /* @__PURE__ */ o(i, {
			value: a,
			children: /* @__PURE__ */ o(t, {})
		})
	})]
};
export { c as default };
