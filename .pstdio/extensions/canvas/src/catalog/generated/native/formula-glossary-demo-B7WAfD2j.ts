// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./bot-DyijWSfK.ts";
import { t } from "./check-Bgh538vW.ts";
import { t as n } from "./terminal-B2gAfUK-.ts";
import { i as r, r as i, s as a } from "./use-landing-styles-CQWLl3TI.ts";
import { t as o } from "./use-demo-cli-BF9LFxZh.ts";
import { t as s } from "./demo-workbench-CNySDkwL.ts";
import { useState as c } from "react";
import { Box as l, Button as u, Code as d, HStack as f, Stack as p, Text as m, chakra as h } from "@chakra-ui/react";
import { Slider as g } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
// clients/landing-page/src/services/financial-formulas.ts
var y = (e) => new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0
}).format(e), b = (e, t) => e === 0 ? t : ((1 + e) ** t - 1) / e, x = (e, t) => Array.from({ length: 101 }, (n, r) => t(e * r / 100)), S = {
	savings: (e) => {
		let { principal: t, monthly: n, rate: r, years: i, inflation: a } = e, o = r / 1200, s = (e) => t * (1 + o) ** (e * 12) + n * b(o, e * 12), c = s(i), l = t + n * i * 12;
		return {
			value: c,
			metrics: [
				{
					label: "Contributed",
					value: l
				},
				{
					label: "Growth",
					value: c - l
				},
				{
					label: "Today's purchasing power",
					value: c / (1 + a / 100) ** i
				}
			],
			values: x(i, s),
			comparison: x(i, (e) => t + n * e * 12),
			chartLabel: "Projected balance",
			comparisonLabel: "Contributions"
		};
	},
	loan: (e) => {
		let { principal: t, rate: n, years: r } = e, i = n / 1200, a = r * 12, o = t * (1 + i) ** a / b(i, a);
		return {
			value: o,
			metrics: [{
				label: "Total interest",
				value: o * a - t
			}, {
				label: "Total repaid",
				value: o * a
			}],
			values: x(r, (e) => Math.max(0, t * (1 + i) ** (e * 12) - o * b(i, e * 12))),
			comparison: x(r, (e) => t * (1 - e / r)),
			chartLabel: "Loan balance",
			comparisonLabel: "At 0% interest"
		};
	},
	dcf: (e) => {
		let { principal: t, cashFlow: n, growth: r, rate: i, years: a } = e, o = -t, s = -t, c = [o], l = [s];
		for (let e = 1; e <= a; e++) {
			let t = n * (1 + r / 100) ** (e - 1);
			o += t / (1 + i / 100) ** e, s += t, c.push(o), l.push(s);
		}
		return {
			value: o,
			metrics: [{
				label: "Present value of cash flows",
				value: o + t
			}, {
				label: "Upfront cost",
				value: t
			}],
			values: c,
			comparison: l,
			chartLabel: "Discounted cash flow",
			comparisonLabel: "Undiscounted"
		};
	}
}, C = (e, t) => S[e](t), w = (e, t) => ({
	command: `finance.${e}`,
	arguments: { ...t },
	result: C(e, t)
}), T = [
	{
		id: "savings",
		name: "Savings with contributions",
		equation: "FV = P(1+i)ⁿ + C[(1+i)ⁿ−1]/i",
		description: "Monthly deposits, compound returns, and inflation in one model. i is the monthly rate; n is the number of months.",
		resultLabel: "Projected balance",
		defaults: {
			principal: 1e4,
			monthly: 300,
			rate: 6,
			years: 15,
			inflation: 2.5
		},
		controls: [
			{
				key: "principal",
				label: "Starting amount",
				min: 1e3,
				max: 1e5,
				step: 1e3,
				unit: "money"
			},
			{
				key: "monthly",
				label: "Monthly contribution",
				min: 0,
				max: 2e3,
				step: 50,
				unit: "money"
			},
			{
				key: "rate",
				label: "Annual return",
				min: 0,
				max: 15,
				step: .5,
				unit: "percent"
			},
			{
				key: "years",
				label: "Time",
				min: 1,
				max: 30,
				step: 1,
				unit: "years"
			},
			{
				key: "inflation",
				label: "Annual inflation",
				min: 0,
				max: 8,
				step: .5,
				unit: "percent"
			}
		],
		question: (e) => `What could ${y(e.principal)} plus ${y(e.monthly)} a month grow to in ${e.years} years at ${e.rate}%? Account for ${e.inflation}% inflation.`,
		answer: (e, t) => `The model gives ${y(t.value)}: ${y(t.metrics[0].value)} contributed and ${y(t.metrics[1].value)} in growth. With inflation, that is ${y(t.metrics[2].value)} in today's dollars.`
	},
	{
		id: "loan",
		name: "Loan amortization",
		equation: "M = Pi(1+i)ⁿ / [(1+i)ⁿ−1]",
		description: "Calculate a fixed monthly payment and see the balance fall. i is the monthly interest rate; n is the number of payments.",
		resultLabel: "Monthly payment",
		defaults: {
			principal: 25e4,
			rate: 5.5,
			years: 25
		},
		controls: [
			{
				key: "principal",
				label: "Loan amount",
				min: 1e4,
				max: 5e5,
				step: 1e4,
				unit: "money"
			},
			{
				key: "rate",
				label: "Annual interest",
				min: 0,
				max: 15,
				step: .25,
				unit: "percent"
			},
			{
				key: "years",
				label: "Loan term",
				min: 1,
				max: 30,
				step: 1,
				unit: "years"
			}
		],
		question: (e) => `For a ${y(e.principal)} loan at ${e.rate}% over ${e.years} years, what is the monthly payment and total interest?`,
		answer: (e, t) => `The monthly payment is ${y(t.value)} across ${e.years * 12} payments. Total interest is ${y(t.metrics[0].value)}, for ${y(t.metrics[1].value)} repaid. This model excludes fees and taxes.`
	},
	{
		id: "dcf",
		name: "Discounted cash flow",
		equation: "NPV = −I₀ + Σ CF₁(1+g)ᵗ⁻¹/(1+r)ᵗ",
		description: "Compare an upfront cost with future cash flows. g is annual growth; r is the discount rate.",
		resultLabel: "Net present value",
		defaults: {
			principal: 5e4,
			cashFlow: 14e3,
			growth: 4,
			rate: 8,
			years: 7
		},
		controls: [
			{
				key: "principal",
				label: "Upfront cost",
				min: 1e4,
				max: 1e5,
				step: 5e3,
				unit: "money"
			},
			{
				key: "cashFlow",
				label: "First-year cash flow",
				min: 1e3,
				max: 5e4,
				step: 1e3,
				unit: "money"
			},
			{
				key: "growth",
				label: "Annual cash flow growth",
				min: 0,
				max: 15,
				step: .5,
				unit: "percent"
			},
			{
				key: "rate",
				label: "Discount rate",
				min: 0,
				max: 20,
				step: .5,
				unit: "percent"
			},
			{
				key: "years",
				label: "Forecast period",
				min: 1,
				max: 15,
				step: 1,
				unit: "years"
			}
		],
		question: (e) => `What is the net present value of ${e.years} years of cash flows starting at ${y(e.cashFlow)}, growing ${e.growth}% a year, against a ${y(e.principal)} cost and a ${e.rate}% discount rate?`,
		answer: (e, t) => `Discounted cash flows total ${y(t.metrics[0].value)}. Subtracting the ${y(t.metrics[1].value)} upfront cost gives a net present value of ${y(t.value)}.`
	}
], E = (r) => {
	let { formula: i, inputs: a, highlighted: o } = r, [h, g] = c(null), y = h?.arguments ?? a;
	return /* @__PURE__ */ v(s, {
		title: "Agent session",
		kind: "command",
		highlighted: o,
		children: [
			/* @__PURE__ */ _(m, {
				textStyle: "paragraph/M/regular",
				children: i.question(y)
			}),
			/* @__PURE__ */ v(u, {
				variant: "subtle",
				alignSelf: "start",
				onClick: () => g(w(i.id, a)),
				children: [/* @__PURE__ */ _(e, {}), h ? "Ask again" : "Ask agent"]
			}),
			h && /* @__PURE__ */ v(p, {
				gap: "md",
				"aria-live": "polite",
				children: [
					/* @__PURE__ */ v(f, {
						gap: "sm",
						children: [
							/* @__PURE__ */ _(n, { size: 16 }),
							/* @__PURE__ */ v(m, {
								textStyle: "label/S/medium",
								children: ["Called ", h.command]
							}),
							/* @__PURE__ */ _(t, { size: 14 })
						]
					}),
					/* @__PURE__ */ _(d, {
						as: "pre",
						p: "md",
						overflowX: "auto",
						children: JSON.stringify(h.arguments, null, 2)
					}),
					/* @__PURE__ */ _(l, {
						role: "status",
						children: /* @__PURE__ */ _(m, {
							textStyle: "paragraph/M/regular",
							children: i.answer(h.arguments, h.result)
						})
					})
				]
			})
		]
	});
}, D = (e) => {
	let { result: t, years: n } = e, i = r(), a = [...t.values, ...t.comparison], o = Math.min(0, ...a), s = Math.max(1, ...a), c = (e) => 200 - (e - o) / (s - o) * 176, l = (e) => e.map((t, n) => `${24 + n / (e.length - 1) * 352},${c(t)}`).join(" ");
	return /* @__PURE__ */ v(p, {
		gap: "xs",
		children: [
			/* @__PURE__ */ v(f, {
				justify: "space-between",
				textStyle: "label/XS/regular",
				color: "fg.muted",
				children: [/* @__PURE__ */ _(m, { children: y(o) }), /* @__PURE__ */ _(m, { children: y(s) })]
			}),
			/* @__PURE__ */ v(h.svg, {
				css: i.plot,
				viewBox: "0 0 400 224",
				role: "img",
				"aria-label": `${t.chartLabel} over ${n} years`,
				children: [
					/* @__PURE__ */ _(h.path, {
						css: i.plotGrid,
						d: "M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200"
					}),
					/* @__PURE__ */ _(h.path, {
						css: i.plotGrid,
						d: `M24 ${c(0)}H376`
					}),
					/* @__PURE__ */ _(h.polyline, {
						css: i.plotComparison,
						points: l(t.comparison)
					}),
					/* @__PURE__ */ _(h.polyline, {
						css: i.plotCurve,
						points: l(t.values)
					}),
					/* @__PURE__ */ _(h.circle, {
						css: i.plotPoint,
						cx: "376",
						cy: c(t.values.at(-1)),
						r: "5"
					})
				]
			}),
			/* @__PURE__ */ v(f, {
				justify: "space-between",
				textStyle: "label/XS/regular",
				color: "fg.muted",
				children: [/* @__PURE__ */ _(m, { children: "Today" }), /* @__PURE__ */ v(m, { children: ["Year ", n] })]
			}),
			/* @__PURE__ */ v(f, {
				gap: "md",
				flexWrap: "wrap",
				textStyle: "label/XS/regular",
				children: [/* @__PURE__ */ v(m, {
					color: "fg.info",
					children: ["━ ", t.chartLabel]
				}), /* @__PURE__ */ v(m, {
					color: "fg.muted",
					children: ["┄ ", t.comparisonLabel]
				})]
			})
		]
	});
}, O = (e) => {
	let { highlighted: t } = e, [n, u] = c({
		id: T[0].id,
		inputs: T[0].defaults
	}), d = o("formulas", (e) => u({
		id: e.id,
		inputs: e.inputs
	})), { inputs: h } = n, b = T.find((e) => e.id === n.id), x = C(b.id, h), S = i(), w = r(), O = a(), k = /* @__PURE__ */ _(E, {
		formula: b,
		inputs: h,
		highlighted: t
	}, b.id);
	return /* @__PURE__ */ v(p, {
		ref: d,
		gap: "panel-gap",
		children: [
			O && k,
			/* @__PURE__ */ v(l, {
				css: S.panels,
				children: [/* @__PURE__ */ v(s, {
					title: "Financial formulas",
					kind: "page",
					highlighted: t,
					children: [/* @__PURE__ */ _(l, {
						css: w.sessions,
						role: "group",
						"aria-label": "Choose a formula",
						children: T.map((e) => /* @__PURE__ */ v(l, {
							as: "button",
							css: w.session,
							"aria-pressed": e.id === b.id,
							onClick: () => u({
								id: e.id,
								inputs: e.defaults
							}),
							children: [/* @__PURE__ */ _(m, {
								textStyle: "label/M/medium",
								children: e.name
							}), /* @__PURE__ */ _(m, {
								textStyle: "mono/XS",
								overflowWrap: "anywhere",
								color: "fg.muted",
								children: e.equation
							})]
						}, e.id))
					}), /* @__PURE__ */ _(p, {
						gap: "lg",
						children: b.controls.map((e) => {
							let t = `${h[e.key]} years`;
							return e.unit === "money" && (t = y(h[e.key])), e.unit === "percent" && (t = `${h[e.key]}%`), /* @__PURE__ */ v(p, {
								gap: "sm",
								children: [/* @__PURE__ */ v(f, {
									justify: "space-between",
									textStyle: "label/S/regular",
									children: [/* @__PURE__ */ _(m, { children: e.label }), /* @__PURE__ */ _(m, { children: t })]
								}), /* @__PURE__ */ _(g, {
									"aria-label": [e.label],
									min: e.min,
									max: e.max,
									step: e.step,
									value: [h[e.key]],
									onValueChange: ({ value: t }) => u((n) => ({
										...n,
										inputs: {
											...n.inputs,
											[e.key]: t[0]
										}
									}))
								})]
							}, e.key);
						})
					})]
				}), /* @__PURE__ */ v(s, {
					title: b.name,
					kind: "editor",
					highlighted: t,
					children: [
						/* @__PURE__ */ _(m, {
							textStyle: "paragraph/S/regular",
							color: "fg.muted",
							children: b.description
						}),
						/* @__PURE__ */ v(p, {
							gap: "xs",
							children: [/* @__PURE__ */ _(m, {
								textStyle: "label/S/regular",
								color: "fg.muted",
								children: b.resultLabel
							}), /* @__PURE__ */ _(m, {
								as: "output",
								"aria-label": "Formula result",
								textStyle: "heading/L",
								children: y(x.value)
							})]
						}),
						/* @__PURE__ */ _(D, {
							result: x,
							years: h.years
						}),
						/* @__PURE__ */ _(p, {
							gap: "md",
							children: x.metrics.map((e) => /* @__PURE__ */ v(f, {
								justify: "space-between",
								gap: "sm",
								flexWrap: "wrap",
								children: [/* @__PURE__ */ _(m, {
									textStyle: "label/S/regular",
									color: "fg.muted",
									children: e.label
								}), /* @__PURE__ */ _(m, {
									textStyle: "label/M/medium",
									children: y(e.value)
								})]
							}, e.label))
						})
					]
				})]
			}),
			!O && k
		]
	});
};
export { O as FormulaGlossaryDemo };
