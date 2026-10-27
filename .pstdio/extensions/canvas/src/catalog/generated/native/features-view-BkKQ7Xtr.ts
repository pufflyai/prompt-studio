// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./bell-Cw2yL2ca.ts";
import { t } from "./blocks-C5COKy0k.ts";
import { t as n } from "./bot-DyijWSfK.ts";
import { n as r, t as i } from "./navigation-D3esDPrC.ts";
import { t as a } from "./check-Bgh538vW.ts";
import { t as o } from "./file-code-Bdj5XAS8.ts";
import { t as s } from "./palette-pgRzNhdq.ts";
import { t as c } from "./search-FHo0INnP.ts";
import { t as l } from "./shapes-DFL0934N.ts";
import { t as u } from "./terminal-B2gAfUK-.ts";
import { i as d, r as f } from "./use-landing-styles-CQWLl3TI.ts";
import { n as p } from "./demo-workbench-CNySDkwL.ts";
import { t as m } from "./use-shader-preview-BjocYG5t.ts";
import { a as h, i as g, t as _ } from "./icon-set-content-4o7Zf8x8.ts";
import { t as v } from "./page-scroll-CScB-LpO.ts";
import { useState as y } from "react";
import { Badge as b, Box as x, Button as S, Code as C, HStack as w, Icon as T, Input as E, InputGroup as D, Kbd as O, Stack as k, Tabs as A, Text as j } from "@chakra-ui/react";
import { ListRow as M, SegmentedControl as N, SessionIndicator as P, Switch as F, useThemePreference as I } from "@pstdio/ui";
import { Fragment as L, jsx as R, jsxs as z } from "react/jsx-runtime";
// clients/landing-page/src/content/workbench-services.ts
var B = [
	{
		id: "search",
		name: "Search",
		description: "Find files, open tools, and run commands from one search.",
		icon: c
	},
	{
		id: "notifications",
		name: "Notifications",
		description: "Know when work finishes or needs your attention.",
		icon: e
	},
	{
		id: "navigation",
		name: "Navigation",
		description: "Switch between your tools and keep useful views open.",
		icon: i
	},
	{
		id: "extensions",
		name: "Extension management",
		description: "Install, enable, and manage the tools in your workbench.",
		icon: t
	},
	{
		id: "themes",
		name: "Themes",
		description: "Use light, dark, or your own theme across all your tools.",
		icon: s
	}
], V = [
	{
		id: "icons",
		label: "Icon set editor",
		detail: "Tool",
		icon: l
	},
	{
		id: "shader",
		label: "icon-rain.frag",
		detail: "Shader file",
		icon: o
	},
	{
		id: "export",
		label: "Export icon set",
		detail: "Command",
		icon: u
	},
	{
		id: "formulas",
		label: "Compound growth",
		detail: "Financial formula",
		icon: r
	}
], H = [
	{
		id: "review",
		title: "Shader controls are ready to review",
		description: "Coding agent dashboard · Just now",
		icon: n
	},
	{
		id: "export",
		title: "24 icons exported",
		description: "Icon set editor · 2 minutes ago",
		icon: l
	},
	{
		id: "glossary",
		title: "Financial glossary updated",
		description: "Formula glossary · 5 minutes ago",
		icon: r
	}
], U = [
	{
		id: "icons",
		name: "Icon set editor",
		icon: l
	},
	{
		id: "shader",
		name: "Shader editor",
		icon: o
	},
	{
		id: "agents",
		name: "Coding agent dashboard",
		icon: n
	}
], W = [
	{
		id: "icons",
		label: "Icons"
	},
	{
		id: "shader",
		label: "Shader"
	},
	{
		id: "formulas",
		label: "Formulas"
	}
], G = [
	_[0],
	_[4],
	_[5],
	_[6],
	_[9],
	_[11]
], K = (e) => {
	let { icon: t } = e, n = d(), r = m(h.source, h.scale, h.speed, t.codepoint);
	return /* @__PURE__ */ z(k, {
		gap: "sm",
		children: [
			/* @__PURE__ */ R(x, {
				as: "canvas",
				ref: r.canvasRef,
				css: n.shaderCanvas,
				role: "img",
				"aria-label": "Extension shader preview"
			}),
			/* @__PURE__ */ R(w, {
				justify: "space-between",
				flexWrap: "wrap",
				gap: "sm",
				children: /* @__PURE__ */ R(j, {
					textStyle: "mono/XS",
					color: "fg.muted",
					children: t.name
				})
			}),
			r.error && /* @__PURE__ */ R(j, {
				role: "alert",
				textStyle: "mono/XS",
				color: "fg.error",
				children: r.error
			})
		]
	});
}, q = () => /* @__PURE__ */ z(k, {
	gap: "lg",
	children: [/* @__PURE__ */ z(k, {
		gap: "sm",
		children: [/* @__PURE__ */ z(w, {
			gap: "sm",
			children: [/* @__PURE__ */ R(P, { status: "completed" }), /* @__PURE__ */ R(j, {
				textStyle: "label/S/medium",
				children: "Codex · Done"
			})]
		}), /* @__PURE__ */ R(j, {
			textStyle: "paragraph/S/regular",
			children: "Connect the icon set to the shader."
		})]
	}), /* @__PURE__ */ z(k, {
		gap: "sm",
		children: [/* @__PURE__ */ z(w, {
			gap: "sm",
			children: [/* @__PURE__ */ R(P, { status: "queued" }), /* @__PURE__ */ R(j, {
				textStyle: "label/S/medium",
				children: "Claude Code · Queued"
			})]
		}), /* @__PURE__ */ R(j, {
			textStyle: "paragraph/S/regular",
			children: "Add an SVG export command."
		})]
	})]
}), J = (e) => {
	let { extension: t, selectedIcon: n, onSelectIcon: r } = e, i = f(), a = d();
	return /* @__PURE__ */ z(x, {
		css: i.panel,
		containerType: "inline-size",
		role: "region",
		"aria-label": `${t.name} panel`,
		children: [/* @__PURE__ */ z(w, {
			css: i.panelHeader,
			children: [/* @__PURE__ */ R(T, {
				as: t.icon,
				boxSize: "icon-sm"
			}), /* @__PURE__ */ R(j, { children: t.name })]
		}), /* @__PURE__ */ z(x, {
			css: i.panelBody,
			children: [
				t.id === "icons" && /* @__PURE__ */ R(x, {
					css: a.iconPicker,
					role: "group",
					"aria-label": "Extension icons",
					children: G.map((e) => /* @__PURE__ */ R(S, {
						variant: "ghost",
						size: "lg",
						"aria-label": `Use ${e.name}`,
						"aria-pressed": n.id === e.id,
						onClick: () => r(e),
						children: /* @__PURE__ */ R(x, {
							css: a.tileSymbol,
							children: /* @__PURE__ */ R(e.icon, {})
						})
					}, e.id))
				}),
				t.id === "shader" && /* @__PURE__ */ R(K, { icon: n }),
				t.id === "agents" && /* @__PURE__ */ R(q, {})
			]
		})]
	});
}, Y = () => {
	let [e, t] = y(U.map((e) => e.id)), [n, r] = y(_[11]), i = f(), a = d();
	return /* @__PURE__ */ z(k, {
		gap: "md",
		children: [/* @__PURE__ */ z(x, {
			css: i.panel,
			children: [/* @__PURE__ */ z(w, {
				css: i.panelHeader,
				children: [/* @__PURE__ */ R(j, {
					flex: "1",
					children: "Installed extensions"
				}), /* @__PURE__ */ z(j, {
					color: "fg.muted",
					children: [e.length, " enabled"]
				})]
			}), /* @__PURE__ */ R(x, {
				css: i.panelBody,
				children: U.map((n) => /* @__PURE__ */ z(w, {
					gap: "md",
					py: "sm",
					children: [
						/* @__PURE__ */ R(T, {
							as: n.icon,
							boxSize: "6",
							color: "fg.muted"
						}),
						/* @__PURE__ */ R(j, {
							flex: "1",
							minWidth: "0",
							textStyle: "label/M/medium",
							children: n.name
						}),
						/* @__PURE__ */ R(F, {
							"aria-label": `Enable ${n.name}`,
							checked: e.includes(n.id),
							onCheckedChange: ({ checked: e }) => t((t) => e ? [...t, n.id] : t.filter((e) => e !== n.id))
						})
					]
				}, n.id))
			})]
		}), /* @__PURE__ */ z(k, {
			gap: "sm",
			children: [/* @__PURE__ */ z(j, {
				textStyle: "label/S/medium",
				children: [
					"Your workbench · ",
					e.length,
					" panels"
				]
			}), /* @__PURE__ */ z(x, {
				css: a.extensionPanels,
				"aria-label": "Extension panels",
				children: [U.filter((t) => e.includes(t.id)).map((e) => /* @__PURE__ */ R(J, {
					extension: e,
					selectedIcon: n,
					onSelectIcon: r
				}, e.id)), e.length === 0 && /* @__PURE__ */ R(x, {
					css: i.panel,
					p: "xl",
					justifyContent: "center",
					alignItems: "center",
					children: /* @__PURE__ */ R(j, {
						textStyle: "paragraph/M/regular",
						color: "fg.muted",
						children: "Enable an extension to add its panel."
					})
				})]
			})]
		})]
	});
}, X = (e) => {
	let { icons: t } = e, n = d();
	return /* @__PURE__ */ R(x, {
		css: n.iconGrid,
		as: "ul",
		"aria-label": "Icon set preview",
		children: t.map((e) => /* @__PURE__ */ z(x, {
			as: "li",
			css: n.iconTile,
			"data-state": e.state,
			children: [
				/* @__PURE__ */ R(x, {
					css: n.tileSymbol,
					children: /* @__PURE__ */ R(e.icon, {})
				}),
				/* @__PURE__ */ R(j, {
					css: n.iconName,
					children: e.name
				}),
				/* @__PURE__ */ z(j, {
					textStyle: "mono/XS",
					color: "fg.muted",
					children: ["U+", e.codepoint]
				})
			]
		}, e.id))
	});
}, Z = {
	search: () => {
		let [e, t] = y(""), [n, r] = y("icons"), i = f(), a = V.filter((t) => `${t.label} ${t.detail}`.toLowerCase().includes(e.toLowerCase())), o = Math.max(0, a.findIndex((e) => e.id === n));
		return /* @__PURE__ */ z(x, {
			css: i.panel,
			children: [/* @__PURE__ */ z(w, {
				css: i.panelHeader,
				children: [/* @__PURE__ */ R(D, {
					startElement: /* @__PURE__ */ R(c, { size: 16 }),
					children: /* @__PURE__ */ R(E, {
						"aria-label": "Search example tools",
						placeholder: "Search tools, files, and commands…",
						value: e,
						variant: "borderless",
						onChange: (e) => t(e.target.value),
						onKeyDown: (e) => {
							if (a.length === 0 || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
							e.preventDefault();
							let t = e.key === "ArrowDown" ? 1 : -1;
							r(a[(o + t + a.length) % a.length].id);
						}
					})
				}), /* @__PURE__ */ R(O, { children: "⌘ P" })]
			}), /* @__PURE__ */ z(k, {
				css: i.panelBody,
				gap: "xs",
				role: "group",
				"aria-label": "Search results",
				children: [a.map((e, t) => /* @__PURE__ */ R(M, {
					label: e.label,
					icon: /* @__PURE__ */ R(e.icon, { size: 16 }),
					isSelected: o === t,
					onActivate: () => r(e.id),
					endContent: /* @__PURE__ */ R(j, {
						textStyle: "label/S/regular",
						color: "fg.muted",
						children: e.detail
					})
				}, e.id)), a.length === 0 && /* @__PURE__ */ R(j, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: "No matching tools or commands."
				})]
			})]
		});
	},
	notifications: () => {
		let [t, n] = y([]), r = f(), i = H.length - t.length;
		return /* @__PURE__ */ z(x, {
			css: r.panel,
			children: [/* @__PURE__ */ z(w, {
				css: r.panelHeader,
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ R(e, { size: 16 }),
					/* @__PURE__ */ R(j, {
						flex: "1",
						children: "Notifications"
					}),
					/* @__PURE__ */ z(b, { children: [i, " unread"] }),
					/* @__PURE__ */ R(S, {
						size: "xs",
						variant: "ghost",
						disabled: i === 0,
						onClick: () => n(H.map((e) => e.id)),
						children: "Mark all read"
					})
				]
			}), /* @__PURE__ */ R(x, {
				css: r.panelBody,
				role: "group",
				"aria-label": "Example notifications",
				children: H.map((e) => /* @__PURE__ */ R(M, {
					label: e.title,
					description: e.description,
					icon: /* @__PURE__ */ R(e.icon, { size: 16 }),
					onActivate: () => n((t) => t.includes(e.id) ? t : [...t, e.id]),
					endContent: t.includes(e.id) ? /* @__PURE__ */ R(a, {
						size: 16,
						"aria-label": "Read"
					}) : /* @__PURE__ */ R(b, {
						colorPalette: "blue",
						children: "New"
					})
				}, e.id))
			})]
		});
	},
	navigation: () => {
		let e = f();
		return /* @__PURE__ */ R(x, {
			css: e.panel,
			children: /* @__PURE__ */ z(A.Root, {
				defaultValue: "icons",
				size: "md",
				lazyMount: !0,
				unmountOnExit: !0,
				children: [/* @__PURE__ */ R(x, {
					css: e.panelHeader,
					children: /* @__PURE__ */ R(A.List, {
						"aria-label": "Example tool navigation",
						flexWrap: "wrap",
						children: W.map((e) => /* @__PURE__ */ R(A.Trigger, {
							value: e.id,
							children: e.label
						}, e.id))
					})
				}), /* @__PURE__ */ z(x, {
					css: e.panelBody,
					children: [
						/* @__PURE__ */ R(A.Content, {
							value: "icons",
							p: "0",
							children: /* @__PURE__ */ R(X, { icons: _.slice(0, 4).map((e) => ({
								...e,
								state: "ready"
							})) })
						}),
						/* @__PURE__ */ R(A.Content, {
							value: "shader",
							p: "0",
							children: /* @__PURE__ */ R(C, {
								as: "pre",
								p: "md",
								overflowX: "auto",
								children: g
							})
						}),
						/* @__PURE__ */ R(A.Content, {
							value: "formulas",
							p: "0",
							children: /* @__PURE__ */ z(k, {
								gap: "md",
								p: "md",
								children: [
									/* @__PURE__ */ R(j, {
										textStyle: "heading/S",
										children: "Compound growth"
									}),
									/* @__PURE__ */ R(j, {
										textStyle: "heading/L",
										children: "$16,289"
									}),
									/* @__PURE__ */ R(j, {
										color: "fg.muted",
										children: "$10,000 · 5% annual return · 10 years"
									})
								]
							})
						})
					]
				})]
			})
		});
	},
	extensions: Y,
	themes: () => {
		let { themePreference: e, setThemePreference: t } = I(), n = f();
		return /* @__PURE__ */ z(x, {
			css: n.panel,
			children: [/* @__PURE__ */ z(w, {
				css: n.panelHeader,
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ R(s, { size: 16 }),
					/* @__PURE__ */ R(j, {
						flex: "1",
						children: "Appearance"
					}),
					/* @__PURE__ */ R(N, {
						"aria-label": "Example theme",
						value: e,
						onValueChange: t,
						options: [{
							value: "pstdio-light",
							label: "Light"
						}, {
							value: "pstdio-dark",
							label: "Dark"
						}]
					})
				]
			}), /* @__PURE__ */ z(x, {
				css: n.panelBody,
				children: [/* @__PURE__ */ R(X, { icons: _.slice(4, 8).map((e) => ({
					...e,
					state: "ready"
				})) }), /* @__PURE__ */ R(j, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					children: "One theme, across your whole workbench."
				})]
			})]
		});
	}
}, Q = () => {
	let e = f();
	return /* @__PURE__ */ z(L, { children: [/* @__PURE__ */ z(k, {
		gap: "sm",
		children: [/* @__PURE__ */ R(j, {
			as: "h1",
			textStyle: {
				base: "heading/M",
				md: "heading/L"
			},
			children: "A solid foundation to extend from"
		}), /* @__PURE__ */ R(j, {
			textStyle: "paragraph/M/regular",
			color: "fg.muted",
			children: "Prompt Studio ships with builtin features that every tool can use."
		})]
	}), B.map((t) => {
		let n = Z[t.id];
		return /* @__PURE__ */ z(x, {
			as: "section",
			css: e.featureSection,
			"aria-labelledby": `service-${t.id}`,
			children: [/* @__PURE__ */ z(w, {
				gap: "md",
				align: "start",
				children: [/* @__PURE__ */ R(T, {
					as: t.icon,
					boxSize: "6",
					color: "fg.muted"
				}), /* @__PURE__ */ z(k, {
					gap: "sm",
					children: [/* @__PURE__ */ R(j, {
						id: `service-${t.id}`,
						as: "h2",
						textStyle: "heading/S",
						children: t.name
					}), /* @__PURE__ */ R(j, {
						textStyle: "paragraph/M/regular",
						color: "fg.muted",
						children: t.description
					})]
				})]
			}), /* @__PURE__ */ R(p, { children: /* @__PURE__ */ R(n, {}) })]
		}, t.id);
	})] });
}, $ = () => {
	let e = f();
	return /* @__PURE__ */ R(v, { children: /* @__PURE__ */ R(x, {
		css: e.page,
		children: /* @__PURE__ */ R(Q, {})
	}) });
};
export { $ as FeaturesView };
