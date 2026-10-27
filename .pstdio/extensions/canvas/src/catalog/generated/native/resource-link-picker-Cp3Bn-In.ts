// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./icon-D3uE7jD-.ts";
import { useEffect as t, useState as n } from "react";
import { Button as r, HStack as i, Input as a, Menu as o, Stack as s, Text as c } from "@chakra-ui/react";
import { AlertMessage as l, ListRow as u, ScrollArea as d } from "@pstdio/ui";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
import { resourceKey as m } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/react/resource-links/resource-link-picker.tsx
var h = (h) => {
	let { service: g, excludeKey: _, busy: v, onCancel: y, onSelect: b } = h, [x, S] = n(""), [C, w] = n([]), [T, E] = n(), [D, O] = n("context"), [k, A] = n(!0), [j, M] = n(), [N, P] = n(0);
	return t(() => g.subscribe(() => {
		E(void 0), P((e) => e + 1);
	}), [g]), t(() => {
		let e = !1, t = new AbortController();
		A(!0), w([]), E(void 0), M(void 0);
		let n = setTimeout(() => {
			g.search(x, t.signal).then((t) => {
				e || w(t.filter((e) => m(e.resource) !== _));
			}).catch((t) => {
				e || M(t instanceof Error ? t.message : String(t));
			}).finally(() => {
				e || A(!1);
			});
		}, 150);
		return () => {
			e = !0, t.abort(), clearTimeout(n);
		};
	}, [
		g,
		x,
		_,
		N
	]), /* @__PURE__ */ p(s, {
		gap: "3",
		children: [
			/* @__PURE__ */ f(a, {
				size: "sm",
				"aria-label": "Search resources",
				placeholder: "Search resources…",
				value: x,
				onChange: (e) => {
					S(e.target.value), E(void 0);
				},
				autoFocus: !0
			}),
			j ? /* @__PURE__ */ f(l, {
				status: "error",
				title: j
			}) : null,
			/* @__PURE__ */ p(d, {
				maxH: "64",
				children: [
					k ? /* @__PURE__ */ f(c, {
						color: "fg.muted",
						textStyle: "sm",
						children: "Searching…"
					}) : null,
					!k && !C.length ? /* @__PURE__ */ f(c, {
						color: "fg.muted",
						textStyle: "sm",
						children: "No resources found."
					}) : null,
					C.map((t) => /* @__PURE__ */ f(u, {
						label: t.resource.label ?? t.resource.shorthand ?? t.resource.id,
						description: t.description,
						icon: /* @__PURE__ */ f(e, { name: t.resource.icon ?? "file-text" }),
						isSelected: T === t,
						onActivate: () => {
							!k && !v && E(t);
						}
					}, m(t.resource)))
				]
			}),
			/* @__PURE__ */ p(o.Root, { children: [/* @__PURE__ */ f(o.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ p(r, {
					variant: "outline",
					size: "sm",
					children: [
						"Purpose: ",
						D,
						/* @__PURE__ */ f(e, { name: "chevron-down" })
					]
				})
			}), /* @__PURE__ */ f(o.Positioner, { children: /* @__PURE__ */ f(o.Content, { children: [
				"primary",
				"context",
				"source",
				"result"
			].map((e) => /* @__PURE__ */ f(o.Item, {
				value: e,
				onClick: () => O(e),
				children: e
			}, e)) }) })] }),
			/* @__PURE__ */ p(i, {
				justify: "flex-end",
				children: [/* @__PURE__ */ f(r, {
					variant: "ghost",
					onClick: y,
					disabled: v,
					children: "Cancel"
				}), /* @__PURE__ */ f(r, {
					disabled: !T || v || k,
					loading: v,
					onClick: () => T && void b(T, D),
					children: "Link"
				})]
			})
		]
	});
};
export { h as t };
