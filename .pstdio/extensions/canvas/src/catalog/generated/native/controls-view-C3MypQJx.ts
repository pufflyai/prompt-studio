// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { _ as e, a as t, c as n, d as r, f as i, g as a, h as o, i as s, m as c, n as l, o as u, v as d } from "./schemas-D84h_Ad-.ts";
import { t as f } from "./resource-ref-D_HHex4N.ts";
import { c as p, n as m } from "./workbench-core-N58OeDyx.ts";
import { t as h } from "./renderer-read-key-WONjLXkB.ts";
import { n as g } from "./use-page-params-BMVjuYZ6.ts";
import { t as _ } from "./renderer-read-notice-Ceo0RX8O.ts";
import { t as v } from "./use-renderer-read-CxbGovUR.ts";
import { t as y } from "./harness-control-CdvEvpxN.ts";
import { useEffect as b, useRef as x, useState as S } from "react";
import { Box as C, Button as w, Flex as T, Stack as E, Text as D } from "@chakra-ui/react";
import { ScrollArea as O } from "@pstdio/ui";
import { jsx as k, jsxs as A } from "react/jsx-runtime";
import { resourceKey as j } from "@pstdio/sdk/extensions";
import { ParamEditor as M } from "@pstdio/ui/param-editor";
// packages/pstdio-api-contracts/src/extensions/control-declarations.ts
var N = {
	id: a(),
	name: a(),
	description: a().optional(),
	readOnly: u().optional()
}, P = {
	min: i().optional(),
	max: i().optional(),
	step: i().optional()
}, F = o({
	x: i(),
	y: i()
}), I = e([i(), i()]), L = o({
	harnessId: a().min(1),
	model: a().optional(),
	params: c(a(), d([a(), u()])).optional()
}), R = d([a(), t(a())]), z = o({
	id: a(),
	name: a(),
	icon: a().optional(),
	color: a().optional(),
	description: a().optional(),
	disabled: u().optional()
}), B = {
	placeholder: a().optional(),
	searchable: u().optional(),
	searchPlaceholder: a().optional(),
	emptyText: a().optional(),
	disabled: u().optional()
}, V = o({
	src: a(),
	alt: a()
}), H = d([
	a(),
	i(),
	u(),
	s()
]), U = d([
	H,
	t(H),
	V.extend({ type: r("image") }),
	o({
		type: r("image-gallery"),
		images: t(V)
	})
]), W = d([
	H,
	t(a()),
	I,
	F,
	L
]), G = c(a(), W), K = n("type", [
	o({
		...N,
		type: r("harness"),
		defaultValue: L
	}),
	o({
		...N,
		...P,
		type: r("number"),
		defaultValue: i()
	}),
	o({
		...N,
		type: r("boolean"),
		defaultValue: u()
	}),
	o({
		...N,
		type: r("text"),
		defaultValue: a(),
		singleLine: u().optional()
	}),
	o({
		...N,
		type: r("markdown"),
		defaultValue: a(),
		placeholder: a().optional()
	}),
	o({
		...N,
		...B,
		type: r("selection"),
		allowCustomValues: u().optional(),
		defaultValue: R,
		options: t(z),
		multiSelect: u().optional(),
		clearable: u().optional(),
		group: o({
			id: a(),
			name: a(),
			defaultValue: a(),
			options: t(z),
			...B
		}).optional()
	}),
	o({
		...N,
		type: r("date"),
		defaultValue: a(),
		min: a().optional(),
		max: a().optional()
	}),
	o({
		...N,
		type: r("color"),
		defaultValue: a()
	}),
	o({
		...N,
		type: r("readOnly"),
		value: U
	}),
	o({
		...N,
		type: r("resource"),
		defaultValue: R,
		options: t(o({
			id: a(),
			name: a(),
			icon: a().optional(),
			color: a().optional(),
			description: a().optional(),
			href: a().optional(),
			ref: f.optional(),
			copyText: a().optional()
		})),
		multiSelect: u().optional(),
		editable: u().optional(),
		placeholder: a().optional(),
		emptyText: a().optional()
	}),
	o({
		...N,
		...P,
		type: r("range"),
		defaultValue: I,
		min: i(),
		max: i(),
		unit: a().optional(),
		markerCount: i().optional()
	}),
	o({
		...N,
		type: r("segmented"),
		defaultValue: a(),
		variant: l(["default", "dots"]).optional(),
		options: t(o({
			id: a(),
			name: a(),
			icon: a().optional(),
			indicatorColor: a().optional()
		}))
	}),
	o({
		...N,
		type: r("actions"),
		defaultValue: a().optional(),
		options: t(o({
			id: a(),
			name: a(),
			icon: a().optional(),
			disabled: u().optional()
		}))
	}),
	o({
		...N,
		type: r("anchorGrid"),
		defaultValue: l([
			"top-left",
			"top",
			"top-right",
			"left",
			"center",
			"right",
			"bottom-left",
			"bottom",
			"bottom-right"
		])
	}),
	o({
		...N,
		...P,
		type: r("vector"),
		defaultValue: F,
		coordinateMode: l(["cartesian", "screen"]).optional(),
		xLabel: a().optional(),
		yLabel: a().optional()
	})
]), q = o({
	id: a(),
	title: a(),
	description: a().optional(),
	params: t(K),
	collapsible: u().optional(),
	defaultCollapsed: u().optional()
}), J = o({
	params: t(K).optional(),
	groups: t(q).optional(),
	values: G.optional(),
	readOnly: u().optional()
}), Y = (e, t, n) => {
	let r = { ...t };
	for (let t of Object.keys(n)) t in e && (r[t] = e[t]);
	return r;
}, X = () => {
	let e = Promise.resolve();
	return (t) => {
		let n = e.then(t);
		return e = n.catch(() => void 0), n;
	};
}, Z = {
	params: [],
	groups: [],
	values: {},
	changed: {},
	readOnly: !1,
	loading: !0
}, Q = (e) => {
	let { contribution: t, placement: n } = e;
	return /* @__PURE__ */ k($, { ...e }, JSON.stringify([t.id, j(n.resource)]));
}, $ = (e) => {
	let { workbench: t, contribution: n, placement: r, renderParamField: i } = e, a = r.resource, o = g(t, r), [s, c] = S(Z), [l, u] = S(!1), d = x(X()), f = x(0), y = v({
		workbench: t,
		ownerKey: h(r),
		queryKey: JSON.stringify([
			n.id,
			j(a),
			o
		]),
		load: (e) => n.executeQuery(a, e, o),
		subscribe: (e) => {
			let r = n.subscribe?.(e), i = m(t).onDidRefreshControlsRenderer((t) => {
				t.controlsRendererId === n.id && e();
			});
			return () => {
				typeof r == "function" ? r() : r?.dispose(), i.dispose();
			};
		}
	});
	b(() => {
		if (!y.value) {
			c(Z);
			return;
		}
		let e = y.value;
		c((t) => ({
			...t,
			params: e.params ?? [],
			groups: e.groups ?? [],
			values: Y(t.values, {
				...n.defaultValues ?? {},
				...e.values ?? {}
			}, t.changed),
			readOnly: !!e.readOnly,
			loading: !1
		}));
	}, [y.value, n.defaultValues]);
	let M = l || s.readOnly || !n.updateValue && !n.apply, N = !!y.value && !s.loading && !s.readOnly && (!!n.apply || !!n.reset), P = (e, r) => {
		let i = W.parse(r), o = {
			...s.values,
			[e]: i
		}, l = ++f.current;
		n.updateValue && p(t, "Update value", () => d.current(async () => {
			try {
				await n.updateValue({
					controlId: e,
					value: i,
					values: o,
					resource: a
				});
			} finally {
				c((t) => {
					if (t.changed[e] !== l) return t;
					let n = { ...t.changed };
					return delete n[e], {
						...t,
						changed: n
					};
				}), await y.retry();
			}
		})), c((t) => ({
			...t,
			values: {
				...t.values,
				[e]: i
			},
			changed: {
				...t.changed,
				[e]: l
			},
			error: void 0
		}));
	}, F = async (e) => {
		u(!0), c((e) => ({
			...e,
			error: void 0
		}));
		try {
			e ? await n.reset?.({ resource: a }) : await n.apply?.({
				values: s.values,
				resource: a
			}), c((t) => ({
				...t,
				changed: {},
				values: e ? {
					...n.defaultValues,
					...y.value?.values
				} : t.values
			})), await y.retry();
		} catch (e) {
			c((t) => ({
				...t,
				error: e instanceof Error ? e.message : String(e)
			}));
		} finally {
			u(!1);
		}
	};
	return /* @__PURE__ */ A(E, {
		h: "full",
		minH: "0",
		gap: "0",
		bg: "bg",
		overflow: "hidden",
		children: [
			y.error ? /* @__PURE__ */ k(_, {
				error: y.error,
				retry: y.retry
			}) : null,
			s.error ? /* @__PURE__ */ k(C, {
				p: "sm",
				children: /* @__PURE__ */ k(D, {
					role: "alert",
					textStyle: "paragraph/S/regular",
					color: "fg",
					children: s.error
				})
			}) : null,
			/* @__PURE__ */ k(O, {
				flex: "1",
				minH: "0",
				minW: "0",
				w: "full",
				size: "xs",
				children: y.value || y.loading ? /* @__PURE__ */ k(ee, {
					state: y.value ? s : Z,
					contribution: n,
					readOnly: M,
					onChange: P,
					renderParamField: i
				}) : null
			}),
			N ? /* @__PURE__ */ A(T, {
				borderTopWidth: "1px",
				borderColor: "border.muted",
				pl: "sm",
				pr: "4xl",
				py: "xs",
				gap: "xs",
				justifyContent: "flex-end",
				children: [n.reset || n.apply ? /* @__PURE__ */ k(w, {
					size: "xs",
					variant: "ghost",
					disabled: l,
					onClick: () => {
						F(!0);
					},
					children: "Reset"
				}) : null, n.apply ? /* @__PURE__ */ k(w, {
					size: "xs",
					variant: "subtle",
					disabled: l,
					onClick: () => {
						F(!1);
					},
					children: "Apply"
				}) : null]
			}) : null
		]
	});
}, ee = (e) => {
	let { state: t, contribution: n, readOnly: r, onChange: i, renderParamField: a } = e, o = (e) => e.type === "harness" ? {
		id: e.id,
		name: "",
		type: "property",
		value: /* @__PURE__ */ k(y, {
			param: e,
			value: t.values[e.id] ?? e.defaultValue,
			readOnly: r,
			renderParamField: a,
			onChange: (t) => i(e.id, t)
		})
	} : e;
	return t.loading ? /* @__PURE__ */ k(C, {
		p: "md",
		children: /* @__PURE__ */ k(D, {
			textStyle: "label/S/regular",
			color: "fg.muted",
			children: "Loading…"
		})
	}) : t.params.length || t.groups.length ? /* @__PURE__ */ k(M, {
		variant: "small",
		params: t.params.map(o),
		groups: t.groups.map((e) => ({
			...e,
			params: e.params.map(o)
		})),
		defaultValues: t.values,
		readOnly: r,
		onChange: i
	}) : /* @__PURE__ */ A(C, {
		p: "md",
		children: [/* @__PURE__ */ k(D, {
			textStyle: "label/M/medium",
			color: "fg",
			children: n.emptyTitle || "No controls"
		}), n.emptyDescription ? /* @__PURE__ */ k(D, {
			textStyle: "label/S/regular",
			color: "fg.muted",
			mt: "2xs",
			children: n.emptyDescription
		}) : null]
	});
};
export { J as n, Q as t };
