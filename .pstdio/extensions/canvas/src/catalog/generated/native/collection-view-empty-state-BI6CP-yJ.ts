// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e } from "./lucide-react-DrMf1u5h.ts";
import { t } from "./x-DqEAa6-d.ts";
import { t as n } from "./empty-state-C7gtd4pd.ts";
import { Button as r, Icon as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-empty-state.tsx
var s = (s) => {
	let { search: c, onClearSearch: l } = s;
	return /* @__PURE__ */ a(n, {
		h: "full",
		icon: /* @__PURE__ */ a(i, { as: e }),
		title: `No results for “${c.trim()}”`,
		description: "Search looks at the titles and properties this view shows.",
		children: /* @__PURE__ */ o(r, {
			size: "2xs",
			variant: "outline",
			onClick: l,
			children: [/* @__PURE__ */ a(t, {}), " Clear search"]
		})
	});
};
export { s as t };
