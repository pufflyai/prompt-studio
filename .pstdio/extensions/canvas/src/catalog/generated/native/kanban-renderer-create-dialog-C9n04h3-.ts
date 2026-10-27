// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./paperclip-CoBJq1oI.ts";
import { t as n } from "./scroll-area-I7hjn89T.ts";
import { p as r } from "./collection-view-fields-D15M65ck.ts";
import { n as i } from "./collection-view-filter-C1-8HUTj.ts";
import { n as a, r as o } from "./react-vHPBN2SX.ts";
import { r as s } from "./browser-storage-CFZrWu9H.ts";
import { i as c, n as l, r as u } from "./host-storage-CRtYziQh.ts";
import { i as d } from "./param-editor-field-DNMN3OG9.ts";
import { t as f } from "./lazy-markdown-editor-EV8pc3Pw.ts";
import { t as p } from "./selection-input-C8HKweBU.ts";
import { t as m } from "./param-editor-horizontal-Dbh-6IOS.ts";
import { useEffect as h, useId as g, useRef as _, useState as v } from "react";
import { Button as y, ButtonGroup as b, CloseButton as x, Dialog as S, HStack as C, Icon as w, IconButton as T, Input as E, Menu as D, Portal as O, Stack as k, Text as A, Textarea as j, Wrap as M } from "@chakra-ui/react";
import { jsx as N, jsxs as P } from "react/jsx-runtime";
// packages/ui/src/components/overlays/dialog-accept-shortcut.ts
var F = (e, t, n = !0) => {
	n && !e.defaultPrevented && e.key === "Enter" && (!e.ctrlKey && !e.metaKey || e.shiftKey || e.altKey || (e.preventDefault(), e.stopPropagation(), t()));
}, I = "pstdio/ui/kanban-renderer/create-preference", L = (e) => o()(s((e) => ({
	openCreatedRow: !0,
	setOpenCreatedRow: (t) => e({ openCreatedRow: t })
}), {
	name: I,
	storage: l(e),
	partialize: ({ openCreatedRow: e }) => ({ openCreatedRow: e })
})), R = u((e, t) => L(t)), z = () => a(R(I, c()));
// packages/ui/src/components/kanban-renderer/kanban-create-submit.tsx
function B(t) {
	let { label: n, withoutOpeningLabel: r, openCreatedRow: i, onChoose: a, onSubmit: o, disabled: s, submitting: c } = t, l = !i && r ? r : n;
	return /* @__PURE__ */ P(D.Root, {
		positioning: { placement: "top-end" },
		children: [/* @__PURE__ */ P(b, {
			size: "sm",
			variant: "primary",
			attached: !0,
			children: [/* @__PURE__ */ N(y, {
				disabled: s || c,
				loading: c,
				onClick: o,
				children: l
			}), r ? /* @__PURE__ */ N(D.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ N(T, {
					"aria-label": r,
					disabled: s || c,
					children: /* @__PURE__ */ N(w, { as: e })
				})
			}) : null]
		}), r ? /* @__PURE__ */ N(O, { children: /* @__PURE__ */ N(D.Positioner, { children: /* @__PURE__ */ N(D.Content, { children: /* @__PURE__ */ P(D.RadioItemGroup, {
			value: i ? "open" : "stay",
			onValueChange: ({ value: e }) => a(e === "open"),
			children: [/* @__PURE__ */ P(D.RadioItem, {
				value: "open",
				children: [n, /* @__PURE__ */ N(D.ItemIndicator, {})]
			}), /* @__PURE__ */ P(D.RadioItem, {
				value: "stay",
				children: [r, /* @__PURE__ */ N(D.ItemIndicator, {})]
			})]
		}) }) }) }) : null]
	});
}
// packages/ui/src/components/kanban-renderer/kanban-renderer-create-field.tsx
var V = (e) => {
	let { disabled: t, field: r, value: i, onChange: a } = e;
	return /* @__PURE__ */ N(n, {
		height: "auto",
		minH: "kanban-create-editor-min",
		maxH: "kanban-create-editor-max",
		flexShrink: "0",
		children: /* @__PURE__ */ N(f, {
			defaultState: typeof i == "string" ? i : "",
			isEditable: !t,
			placeholder: r.placeholder,
			scrollable: !1,
			autoFocus: !0,
			onChange: (e) => a(e)
		})
	});
}, H = (e) => {
	let { disabled: n, field: r, removeLabel: i, value: a, onChange: o } = e, s = _(null), c = Array.isArray(a) ? a : [];
	return /* @__PURE__ */ P(k, {
		gap: "2xs",
		align: "start",
		children: [
			/* @__PURE__ */ N("input", {
				ref: s,
				hidden: !0,
				type: "file",
				accept: r.accept,
				multiple: r.multiple !== !1,
				onChange: (e) => {
					let t = Array.from(e.target.files ?? []);
					o(r.multiple === !1 ? t.slice(0, 1) : [...c, ...t]), e.target.value = "";
				}
			}),
			/* @__PURE__ */ P(y, {
				size: "xs",
				variant: "ghost",
				disabled: n,
				onClick: () => s.current?.click(),
				children: [/* @__PURE__ */ N(w, {
					as: t,
					boxSize: "4"
				}), r.label]
			}),
			c.length > 0 ? /* @__PURE__ */ N(M, {
				gap: "2xs",
				children: c.map((e, t) => /* @__PURE__ */ N(d, {
					file: e,
					disabled: n,
					removeLabel: i,
					onRemove: () => o(c.filter((e, n) => n !== t))
				}, `${e.name}-${t.toString()}`))
			}) : null
		]
	});
}, U = (e) => {
	let { disabled: t, field: n, value: r, onChange: i } = e;
	return n.type === "longtext" ? /* @__PURE__ */ N(j, {
		"aria-label": n.label,
		minH: "120px",
		size: "sm",
		placeholder: n.placeholder,
		value: typeof r == "string" ? r : "",
		disabled: t,
		onChange: (e) => i(e.target.value)
	}) : n.type === "select" || n.type === "multi-select" ? /* @__PURE__ */ N(p, {
		hideLabel: !0,
		id: n.id,
		name: n.label,
		description: n.description ?? "",
		defaultValue: r ?? (n.type === "multi-select" ? [] : ""),
		options: (n.options ?? []).map((e) => ({
			id: e.value,
			name: e.label,
			icon: e.icon ?? void 0,
			color: e.color
		})),
		multiSelect: n.type === "multi-select",
		placeholder: n.placeholder ?? n.label,
		clearable: !n.required,
		readOnly: t,
		onChange: (e, t) => i(t)
	}) : n.type === "boolean" ? /* @__PURE__ */ N(y, {
		size: "sm",
		variant: "outline",
		disabled: t,
		onClick: () => i(r !== !0),
		children: n.label
	}) : /* @__PURE__ */ N(E, {
		"aria-label": n.label,
		size: "sm",
		type: n.type === "number" ? "number" : "text",
		placeholder: n.placeholder,
		value: typeof r == "string" || typeof r == "number" ? r : "",
		disabled: t,
		onChange: (e) => i(n.type === "number" && e.target.value ? Number(e.target.value) : e.target.value)
	});
}, W = (e) => {
	let { disabled: t, field: n, removeLabel: r, value: i, onChange: a } = e;
	return n.type === "files" ? /* @__PURE__ */ N(H, {
		disabled: t,
		field: n,
		removeLabel: r,
		value: i,
		onChange: a
	}) : n.type === "markdown" ? /* @__PURE__ */ N(V, {
		disabled: t,
		field: n,
		value: i,
		onChange: a
	}) : /* @__PURE__ */ P(k, {
		gap: "2xs",
		children: [
			/* @__PURE__ */ N(A, {
				textStyle: "label/S/medium",
				children: `${n.label}${n.required ? " *" : ""}`
			}),
			n.description ? /* @__PURE__ */ N(A, {
				textStyle: "paragraph/XS/regular",
				color: "fg.muted",
				children: n.description
			}) : null,
			/* @__PURE__ */ N(U, { ...e })
		]
	});
}, G = (e) => {
	let t = (e.groups ?? []).map(G);
	return e.conjunction === "or" ? [...e.rules.map((e) => [e]), ...t.flat()] : t.reduce((e, t) => e.flatMap((e) => t.map((t) => [...e, ...t])), [e.rules]);
}, K = (e, t) => {
	let n = t.filter((e) => [
		"is",
		"contains",
		"is-any-of",
		"has-any-of",
		"has-all-of"
	].includes(e.condition)).flatMap((e) => e.value === void 0 ? [] : [e.value]).flat(), i = r(e.type).map((e) => e.value);
	if (e.type.kind !== "enum-multi") return [
		...n,
		...i,
		""
	];
	let a = t.filter((e) => ["has-none-of", "is-none-of"].includes(e.condition)).flatMap((e) => e.value ?? []).flat();
	return [
		[...new Set(n)].filter((e) => !a.includes(e)),
		...i.map((e) => [e]),
		[]
	];
}, q = (e, t, n, r = {
	conjunction: "and",
	rules: []
}) => {
	let a = e.filter((e) => e.editable), o = Object.fromEntries(a.map((e) => {
		let r = e.type.kind === "enum-multi" ? [] : "";
		return [e.id, e.id === t ? n : r];
	})), s = new Set(a.map((e) => e.id)), c = (e) => e.filter((e) => !s.has(e.attributeId)).length, l = G(r).sort((e, t) => c(e) - c(t));
	for (let e of l) {
		let r = { ...o }, s = !0;
		for (let o of a) {
			let a = e.filter((e) => e.attributeId === o.id);
			if (a.length === 0) continue;
			let c = (o.id === t ? [n] : K(o, a)).find((e) => i([{
				id: "draft",
				title: "",
				attributes: { [o.id]: e }
			}], {
				conjunction: "and",
				rules: a
			}, [o]).length > 0);
			if (c === void 0) {
				s = !1;
				break;
			}
			r[o.id] = c;
		}
		if (s) return r;
	}
	return o;
}, J = u(() => o((e) => ({
	draft: null,
	setDraft: (t) => e((e) => {
		let n = t(e.draft);
		return n === e.draft ? e : { draft: n };
	}),
	clearDraft: () => e({ draft: null })
}))), Y = (e) => a(J(e, c())), X = (e) => e.type === "files" || e.type === "multi-select" ? [] : e.type !== "boolean" && "", Z = (e) => Object.fromEntries(e.map((e) => [e.id, e.defaultValue ?? X(e)])), Q = (e, t) => e.required ? Array.isArray(t) ? t.length > 0 : typeof t == "string" ? t.trim().length > 0 : t != null : !0, $ = (e) => e.filter((e) => e.editable), ee = (e, t) => {
	let n = {
		id: e.id,
		name: e.label,
		description: ""
	};
	if (e.type.kind === "enum" || e.type.kind === "enum-multi") {
		let i = e.type.kind === "enum-multi";
		return {
			...n,
			type: "selection",
			defaultValue: i ? [] : "",
			multiSelect: i,
			placeholder: e.label,
			clearable: !t,
			disabled: t,
			options: r(e.type).map((e) => ({
				id: e.value,
				name: e.label,
				icon: e.icon ?? void 0,
				color: e.color
			}))
		};
	}
	return e.type.kind === "number" ? {
		...n,
		type: "number",
		defaultValue: 0
	} : {
		...n,
		type: "text",
		defaultValue: "",
		singleLine: !0
	};
}, te = (e) => {
	let { open: t, columnId: r, columnAttributeId: i, attributes: a, config: o, draftKey: s, filter: c, onClose: l, onSubmit: u } = e, d = g(), { draft: f, setDraft: p, clearDraft: _ } = Y(s ?? d), { openCreatedRow: b, setOpenCreatedRow: w } = z(), T = f?.values ?? {}, E = f?.attributeValues ?? {}, [D, O] = v(!1), [j, M] = v(""), I = $(a);
	h(() => {
		t && p((e) => e ?? {
			values: Z(o.fields),
			attributeValues: q(a, i, r, c)
		});
	}, [
		a,
		i,
		r,
		o.fields,
		c,
		t,
		p
	]), h(() => {
		t && M("");
	}, [t]), h(() => {
		if (!t) return;
		let e = Z(o.fields), n = new Set(o.fields.map((e) => e.id));
		p((t) => {
			if (!t) return t;
			let r = Object.entries(t.values).filter(([e]) => n.has(e)), i = Object.entries(e).filter(([e]) => !(e in t.values));
			return i.length === 0 && r.length === Object.keys(t.values).length ? t : {
				...t,
				values: {
					...Object.fromEntries(i),
					...Object.fromEntries(r)
				}
			};
		});
	}, [
		o.fields,
		t,
		p
	]), h(() => {
		if (!t) return;
		let e = $(a), n = q(e, i, r, c), o = new Set(e.map((e) => e.id));
		p((e) => {
			if (!e) return e;
			let t = Object.entries(e.attributeValues).filter(([e]) => o.has(e)), a = Object.entries(n).filter(([t]) => !(t in e.attributeValues)), s = i && e.attributeValues[i] !== r;
			return a.length === 0 && t.length === Object.keys(e.attributeValues).length && !s ? e : {
				...e,
				attributeValues: {
					...Object.fromEntries(a),
					...Object.fromEntries(t),
					...i ? { [i]: r } : {}
				}
			};
		});
	}, [
		a,
		t,
		r,
		i,
		c,
		p
	]);
	let L = () => {
		D || l();
	}, R = () => {
		D || (_(), l());
	}, V = o.fields.every((e) => Q(e, T[e.id])), H = async () => {
		if (V && !D) {
			O(!0), M("");
			try {
				let e = new Set(o.fields.filter((e) => e.type === "files").map((e) => e.id)), t = [...e].flatMap((e) => Array.isArray(T[e]) ? T[e] : []), n = Object.fromEntries(Object.entries(T).filter(([t]) => !e.has(t)));
				await u({
					columnId: r,
					columnAttributeId: i,
					values: n,
					attributeValues: E,
					files: t,
					openCreatedRow: !o.labels.submitWithoutOpening || b
				}), _(), l();
			} catch (e) {
				M(e instanceof Error ? e.message : o.labels.submitError);
			} finally {
				O(!1);
			}
		}
	};
	return f ? /* @__PURE__ */ P(S.Root, {
		open: t,
		size: "lg",
		variant: "create",
		scrollBehavior: "inside",
		closeOnInteractOutside: !1,
		onOpenChange: (e) => !e.open && L(),
		children: [/* @__PURE__ */ N(S.Backdrop, {}), /* @__PURE__ */ N(S.Positioner, { children: /* @__PURE__ */ P(S.Content, {
			onKeyDownCapture: (e) => F(e, () => void H(), V && !D),
			children: [
				/* @__PURE__ */ P(S.Header, { children: [/* @__PURE__ */ N(S.Title, { children: o.title }), /* @__PURE__ */ N(S.CloseTrigger, {
					asChild: !0,
					children: /* @__PURE__ */ N(x, {
						size: "sm",
						disabled: D,
						onClick: R
					})
				})] }),
				/* @__PURE__ */ N(n, {
					flex: "1",
					minH: "0",
					height: "auto",
					children: /* @__PURE__ */ N(S.Body, { children: /* @__PURE__ */ P(k, {
						gap: "md",
						children: [
							o.fields.map((e) => /* @__PURE__ */ N(W, {
								field: e,
								removeLabel: o.labels.removeFile,
								value: T[e.id],
								disabled: D,
								onChange: (t) => p((n) => n && {
									...n,
									values: {
										...n.values,
										[e.id]: t
									}
								})
							}, e.id)),
							I.length > 0 ? /* @__PURE__ */ P(k, {
								gap: "2xs",
								children: [/* @__PURE__ */ N(A, {
									textStyle: "label/S/medium",
									children: o.labels.properties
								}), /* @__PURE__ */ N(m, {
									variant: "small",
									params: I.map((e) => ee(e, e.id === i)),
									defaultValues: E,
									readOnly: D,
									onChange: (e, t) => p((n) => n && {
										...n,
										attributeValues: {
											...n.attributeValues,
											[e]: t
										}
									})
								})]
							}) : null,
							j ? /* @__PURE__ */ N(A, {
								textStyle: "paragraph/S/regular",
								color: "fg.error",
								children: j
							}) : null
						]
					}) })
				}),
				/* @__PURE__ */ N(S.Footer, {
					justifyContent: "end",
					children: /* @__PURE__ */ P(C, {
						gap: "2",
						children: [/* @__PURE__ */ N(y, {
							size: "sm",
							variant: "ghost",
							disabled: D,
							onClick: L,
							children: o.labels.cancel
						}), /* @__PURE__ */ N(B, {
							label: o.submitLabel,
							withoutOpeningLabel: o.labels.submitWithoutOpening,
							openCreatedRow: b,
							onChoose: w,
							onSubmit: () => void H(),
							disabled: !V,
							submitting: D
						})]
					})
				})
			]
		}) })]
	}) : null;
};
export { te as t };
