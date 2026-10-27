// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useEffect as e, useEffectEvent as t, useState as n } from "react";
import { Button as r, Dialog as i, Stack as a, Text as o, useRecipe as s } from "@chakra-ui/react";
import { Checkbox as c, ScrollArea as l } from "@pstdio/ui";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
import { psTheme as p } from "@pstdio/ui/theme";
import { buildFilterCategories as m } from "@pstdio/ui/kanban-renderer";
import { CollectionFilter as h } from "@pstdio/ui/collection-view";
import { LazyMarkdownEditor as g } from "@pstdio/ui/rich-text";
import { HarnessModelPicker as _, HarnessParamEditor as v, filterHarnessParamValues as y } from "@pstdio/ui/param-editor";
// extensions/pstdio-planner/src/timeline/view/supervisor-model-field.tsx
function b(r) {
	let { host: i, label: a, value: s, disabled: c, onChange: l } = r, [p, m] = n(), [h, g] = n(), b = s?.harnessId, C = s?.model, w = t((e) => {
		m(e), !s && e.selection ? l(e.selection) : s && e.selection && l({
			...e.selection,
			params: y(S(e.schema), s.params)
		});
	});
	return e(() => {
		let e = !0;
		return g(void 0), x(i, b, C).then((t) => {
			e && w(t);
		}).catch((t) => {
			e && g(String(t));
		}), () => {
			e = !1;
		};
	}, [
		i,
		b,
		C
	]), /* @__PURE__ */ f(u, { children: [
		/* @__PURE__ */ d(_, {
			label: a,
			harnesses: (p?.harnesses ?? []).map((e) => ({
				id: e.id,
				name: e.name,
				disabled: e.availability.type === "NOT_FOUND"
			})),
			models: (p?.models ?? []).map((e) => ({
				id: e.id,
				name: e.label ?? e.id,
				description: e.description
			})),
			harnessId: b ?? "",
			model: C,
			disabled: c,
			loadingHarnesses: !p,
			loadingModels: !p,
			onHarnessChange: (e) => l({ harnessId: e }),
			onModelChange: (e) => l({
				harnessId: b,
				model: e,
				params: s?.params
			})
		}),
		/* @__PURE__ */ d(v, {
			schema: S(p?.schema),
			defaults: p?.defaults,
			overrides: s?.params ?? {},
			disabled: c,
			onOverridesChange: (e) => l({
				...s,
				params: e
			})
		}),
		h ? /* @__PURE__ */ d(o, {
			role: "alert",
			color: "fg.error",
			children: h
		}) : null
	] });
}
var x = (e, t, n) => e.call("harnesses.read", {
	harnessId: t,
	model: n
}), S = (e) => Object.fromEntries(Object.entries(e ?? {}).filter(([e]) => e !== "collaboration_mode"));
// extensions/pstdio-planner/src/timeline/view/auto-build-form.tsx
function C(e) {
	let { prompt: t, eligible: _, supervisorModel: v, host: y, requireMergedDependencies: x, data: S, saving: C, error: w, onEnable: T, onClose: E, t: D } = e, [O, k] = n(t), [A, j] = n(v), [M, N] = n(_), [P, F] = n(x), I = s({ recipe: p.getRecipe("button") }), L = m(S.attributes, S.rows), R = D("timeline.autoBuild.eligible", "Eligible tickets"), z = async () => {
		await T(O, P, M, A) && E();
	};
	return /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(i.Body, {
		flex: "1",
		minH: "0",
		p: "0",
		children: /* @__PURE__ */ d(l, {
			h: "full",
			contentProps: { py: "md" },
			children: /* @__PURE__ */ f(a, {
				gap: "md",
				children: [
					/* @__PURE__ */ d(a, {
						px: "lg",
						children: /* @__PURE__ */ d(g, {
							autoFocus: !0,
							defaultState: O,
							isEditable: !C,
							placeholder: D("timeline.autoBuild.prompt", "Describe the work to build…"),
							onChange: k
						})
					}),
					/* @__PURE__ */ d(a, {
						gap: "0",
						px: "sm",
						children: /* @__PURE__ */ d(b, {
							host: y,
							value: A,
							onChange: j,
							disabled: C,
							label: D("timeline.autoBuild.supervisorModel", "Supervisor model")
						})
					}),
					/* @__PURE__ */ f(a, {
						gap: "md",
						px: "lg",
						children: [
							/* @__PURE__ */ f(a, {
								gap: "xs",
								role: "group",
								"aria-label": R,
								children: [/* @__PURE__ */ d(o, {
									textStyle: "label/S/medium",
									children: R
								}), /* @__PURE__ */ d(h, {
									filter: M,
									onFilterChange: (e) => !C && N(e),
									itemLabel: "Ticket",
									fields: S.attributes,
									optionsFor: (e) => L.find(({ id: t }) => t === e.id)?.options ?? []
								})]
							}),
							/* @__PURE__ */ d(c, {
								size: "sm",
								checked: P,
								disabled: C,
								onCheckedChange: ({ checked: e }) => F(e === !0),
								children: D("timeline.autoBuild.requireMerged", "Require merged dependencies")
							}),
							w ? /* @__PURE__ */ d(o, {
								role: "alert",
								color: "fg.error",
								children: w
							}) : null
						]
					})
				]
			})
		})
	}), /* @__PURE__ */ f(i.Footer, { children: [/* @__PURE__ */ d(r, {
		size: "sm",
		variant: "outline",
		onClick: E,
		disabled: C,
		children: D("timeline.autoBuild.cancel", "Cancel")
	}), /* @__PURE__ */ d(r, {
		size: "sm",
		css: I({
			variant: "primary",
			size: "sm"
		}),
		onClick: () => void z(),
		loading: C,
		disabled: C || !O.trim(),
		children: D("timeline.autoBuild.start", "Auto Build")
	})] })] });
}
export { C as AutoBuildForm };
