// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./resource-badge-Cd8iYFfh.ts";
import { Fragment as t } from "react";
import { Stack as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/attachment-list.tsx
var i = "md", a = "neutral", o = (o) => {
	let { attachments: s = [], onSelect: c, onRemove: l, renderBadge: u, size: d = i, tone: f = a } = o;
	return s.length === 0 ? null : /* @__PURE__ */ r(n, {
		marginBottom: "sm",
		gap: "1",
		flexDir: "row",
		flexWrap: "wrap",
		children: s.map((n) => {
			let i = c ? () => c(n) : void 0, a = l ? () => l(n) : void 0;
			if (u) {
				let e = u({
					attachmentId: n,
					onSelect: i,
					onRemove: a,
					size: d,
					tone: f
				});
				return /* @__PURE__ */ r(t, { children: e }, n);
			}
			return /* @__PURE__ */ r(e, {
				fileName: n,
				onSelect: i,
				onRemove: a,
				size: d,
				tone: f
			}, n);
		})
	});
};
export { o as t };
