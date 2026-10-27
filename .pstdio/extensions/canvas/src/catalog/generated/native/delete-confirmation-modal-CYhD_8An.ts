// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useState as e } from "react";
import { Button as t, CloseButton as n, Dialog as r, Portal as i, Stack as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/overlays/delete-confirmation-modal.tsx
var l = (l) => {
	let [u, d] = e(!1), { headline: f, buttonText: p, notificationText: m, onDelete: h, open: g, onClose: _, children: v } = l;
	return /* @__PURE__ */ s(r.Root, {
		size: "sm",
		open: g,
		onOpenChange: (e) => {
			!e.open && !u && _();
		},
		closeOnInteractOutside: !1,
		children: /* @__PURE__ */ c(i, { children: [/* @__PURE__ */ s(r.Backdrop, {}), /* @__PURE__ */ s(r.Positioner, { children: /* @__PURE__ */ c(r.Content, { children: [
			/* @__PURE__ */ c(r.Header, { children: [/* @__PURE__ */ s(o, {
				textStyle: "heading/M",
				children: f
			}), /* @__PURE__ */ s(r.CloseTrigger, {
				asChild: !0,
				children: /* @__PURE__ */ s(n, {
					size: "sm",
					disabled: u
				})
			})] }),
			/* @__PURE__ */ s(r.Body, { children: /* @__PURE__ */ c(a, {
				gap: "3",
				children: [m ? /* @__PURE__ */ s(o, { children: m }) : null, v]
			}) }),
			/* @__PURE__ */ s(r.Footer, { children: /* @__PURE__ */ c(a, {
				direction: "row",
				gap: "1",
				children: [/* @__PURE__ */ s(t, {
					onClick: _,
					disabled: u,
					children: "Close"
				}), /* @__PURE__ */ s(t, {
					loading: u,
					variant: "destructive",
					onClick: async () => {
						d(!0);
						try {
							await h(), _();
						} catch {} finally {
							d(!1);
						}
					},
					children: p
				})]
			}) })
		] }) })] })
	});
};
export { l as t };
