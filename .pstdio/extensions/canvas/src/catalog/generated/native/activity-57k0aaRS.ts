// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-DUoQ-jFn.ts";
import { t } from "./paperclip-CoBJq1oI.ts";
import { a as n, c as r, i, n as a, o, r as s, s as c, t as l } from "./activity-timeline-CREzUpF3.ts";
import { t as u } from "./tooltip-BweQW627.ts";
import { useState as d } from "react";
import { Box as f, HStack as p, Icon as m, IconButton as h, Spacer as g, Textarea as _, chakra as v } from "@chakra-ui/react";
import { jsx as y, jsxs as b } from "react/jsx-runtime";
// packages/ui/src/components/activity/index.ts
var x = {
	Root: i,
	Header: s,
	Feed: a,
	Timeline: l,
	Event: n,
	Comment: o,
	Reply: c,
	Composer: (n) => {
		let { actor: i, value: a, defaultValue: o = "", placeholder: s = "Leave a comment...", variant: c = "standalone", minRows: l = c === "standalone" ? 3 : 1, attachLabel: x = "Attach file", submitLabel: S = "Submit comment", actions: C, onAttach: w, onChange: T, onSubmit: E, ...D } = n, [O, k] = d(o), A = a ?? O, j = c === "inline", M = A.trim().length > 0, N = (e) => {
			a === void 0 && k(e), T?.(e);
		};
		return /* @__PURE__ */ y(v.form, {
			width: "full",
			background: "bg",
			borderWidth: j ? "0" : "1px",
			borderColor: "border",
			borderRadius: j ? "0" : "sm",
			transition: "border-color 0.12s ease",
			_hover: j ? void 0 : { borderColor: "border" },
			_focusWithin: j ? void 0 : { borderColor: "border.accent" },
			onSubmit: (e) => {
				e.preventDefault(), M && (E?.(A.trim()), a === void 0 && k(""));
			},
			...D,
			children: /* @__PURE__ */ b(p, {
				alignItems: "flex-start",
				gap: "xs",
				padding: j ? "sm" : "md",
				children: [i ? /* @__PURE__ */ y(r, { actor: i }) : null, /* @__PURE__ */ b(f, {
					flex: "1",
					minW: "0",
					children: [/* @__PURE__ */ y(_, {
						value: A,
						rows: l,
						resize: "none",
						border: "0",
						padding: "0",
						minH: j ? "1.5rem" : "4rem",
						background: "transparent",
						color: "fg",
						textStyle: "label/S/regular",
						placeholder: s,
						_placeholder: { color: "fg.subtle" },
						onChange: (e) => N(e.currentTarget.value)
					}), /* @__PURE__ */ b(p, {
						gap: "2xs",
						marginTop: j ? "0" : "sm",
						children: [
							C,
							/* @__PURE__ */ y(g, {}),
							/* @__PURE__ */ y(u, {
								content: x,
								children: /* @__PURE__ */ y(h, {
									size: "2xs",
									variant: "ghost",
									"aria-label": x,
									type: "button",
									onClick: w,
									children: /* @__PURE__ */ y(m, {
										as: t,
										boxSize: "14px"
									})
								})
							}),
							/* @__PURE__ */ y(u, {
								content: S,
								children: /* @__PURE__ */ y(h, {
									size: "2xs",
									variant: "subtle",
									"aria-label": S,
									type: "submit",
									disabled: !M,
									children: /* @__PURE__ */ y(m, {
										as: e,
										boxSize: "14px"
									})
								})
							})
						]
					})]
				})]
			})
		});
	},
	Avatar: r
};
export { x as t };
