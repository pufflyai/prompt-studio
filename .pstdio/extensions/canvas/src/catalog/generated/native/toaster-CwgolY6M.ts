// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { Portal as t, Spinner as n, Stack as r, Toast as i, Toaster as a, createToaster as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/primitives/toaster.tsx
var l = o({
	placement: "top",
	pauseOnPageIdle: !0,
	duration: 1e4,
	offsets: {
		top: "var(--pstdio-toast-top-offset, var(--chakra-spacing-md))",
		bottom: "var(--chakra-spacing-md)",
		left: "var(--chakra-spacing-md)",
		right: "var(--chakra-spacing-md)"
	}
}), u = () => /* @__PURE__ */ s(t, { children: /* @__PURE__ */ s(a, {
	toaster: l,
	insetInline: { mdDown: "4" },
	children: (t) => /* @__PURE__ */ c(i.Root, {
		width: { md: "sm" },
		alignItems: "start",
		borderRadius: "xs",
		gap: "xs",
		px: "sm",
		py: "xs",
		minH: "auto",
		children: [
			t.type === "loading" ? /* @__PURE__ */ s(n, {
				size: "sm",
				color: "blue.solid"
			}) : /* @__PURE__ */ s(i.Indicator, {}),
			/* @__PURE__ */ c(r, {
				gap: "0",
				flex: "1",
				minWidth: "0",
				maxWidth: "100%",
				children: [t.title && /* @__PURE__ */ s(i.Title, {
					textStyle: "label/S/medium",
					children: t.title
				}), t.description && /* @__PURE__ */ s(e, {
					maxHeight: "12rem",
					contentProps: { paddingEnd: "1" },
					children: /* @__PURE__ */ s(i.Description, {
						textStyle: "paragraph/S/regular",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						children: t.description
					})
				})]
			}),
			t.action && /* @__PURE__ */ s(i.ActionTrigger, { children: t.action.label }),
			/* @__PURE__ */ s(i.CloseTrigger, {})
		]
	})
}) });
export { l as n, u as t };
