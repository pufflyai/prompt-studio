// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Box as e, HStack as t, Separator as n, Text as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/model-swap-separator.tsx
var o = (e) => {
	let { fromModel: o, toModel: s } = e;
	return /* @__PURE__ */ a(t, {
		width: "full",
		gap: "xs",
		py: "xs",
		align: "center",
		children: [
			/* @__PURE__ */ i(n, {
				flex: "1",
				variant: "dashed"
			}),
			/* @__PURE__ */ a(r, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				textAlign: "center",
				flexShrink: "0",
				children: [
					"Model changed from ",
					o,
					" to ",
					s,
					"."
				]
			}),
			/* @__PURE__ */ i(n, {
				flex: "1",
				variant: "dashed"
			})
		]
	});
}, s = {
	title: "Patterns/Chat/Model Swap Separator",
	component: o,
	parameters: { layout: "padded" }
}, c = {
	render: (t) => /* @__PURE__ */ i(e, {
		maxW: "960px",
		w: "full",
		borderWidth: "1px",
		borderRadius: "md",
		bg: "bg",
		p: "md",
		children: /* @__PURE__ */ i(o, { ...t })
	}),
	args: {
		fromModel: "GPT-5.3-Codex",
		toModel: "GPT-5.2"
	}
};
export { c as Default, s as default };
