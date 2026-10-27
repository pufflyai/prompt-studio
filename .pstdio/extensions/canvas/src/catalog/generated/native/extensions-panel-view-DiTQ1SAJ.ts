// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { t } from "./circle-arrow-up-C11LjouQ.ts";
import { t as n } from "./download-B4RJJThF.ts";
import { t as r } from "./folder-DJ8ZbA4G.ts";
import { t as i } from "./globe-CC58dLi6.ts";
import { t as a } from "./puzzle-BKD3K9Fw.ts";
import { t as o } from "./search-FHo0INnP.ts";
import { t as s } from "./timer-B6AbcL3H.ts";
import { t as c } from "./useTranslation-DvWg4zeU.ts";
import { t as l } from "./extension-localization-BwKrr4Fv.ts";
import { t as u } from "./extension-health-popover-CKJTh5RS.ts";
import { t as d } from "./extension-folder-drop-zone-CaZTla_c.ts";
import { useState as f } from "react";
import { Box as p, Button as m, Flex as h, HStack as g, Icon as _, IconButton as v, Input as y, InputGroup as b, Popover as x, Portal as S, Stack as C, Text as w } from "@chakra-ui/react";
import { Switch as T, Tooltip as E } from "@pstdio/ui";
import { jsx as D, jsxs as O } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-harness-availability.ts
var k = (e, t, n) => {
	if (!e.enabled) return [];
	let r = new Set((t ?? []).filter((t) => t.extensionId === e.extensionId).map((e) => e.id));
	return (n ?? []).filter((e) => r.has(e.id) && e.availability.type === "NOT_FOUND");
}, A = (e) => {
	let { extensionName: t, automations: n } = e, { t: r } = c("projects");
	if (n.length === 0) return null;
	let i = n.filter((e) => e.enabled).length;
	return /* @__PURE__ */ O(x.Root, {
		positioning: { placement: "bottom-end" },
		children: [/* @__PURE__ */ D(x.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ O(m, {
				variant: "ghost",
				size: "2xs",
				color: "fg.subtle",
				gap: "2xs",
				"data-testid": "extension-automations-trigger",
				"aria-label": r("projectSettings.extensionsPanel.automations.listStatus", {
					enabled: i,
					count: n.length
				}),
				children: [/* @__PURE__ */ D(_, {
					boxSize: "3.5",
					children: /* @__PURE__ */ D(s, {})
				}), /* @__PURE__ */ O(w, {
					textStyle: "label/XS",
					fontFamily: "mono",
					children: [
						i,
						"/",
						n.length
					]
				})]
			})
		}), /* @__PURE__ */ D(S, { children: /* @__PURE__ */ D(x.Positioner, { children: /* @__PURE__ */ D(x.Content, {
			width: "320px",
			"data-testid": "extension-automations-popover",
			children: /* @__PURE__ */ D(x.Body, {
				padding: "0",
				children: /* @__PURE__ */ O(C, {
					gap: "0",
					children: [/* @__PURE__ */ O(g, {
						paddingX: "md",
						paddingY: "sm",
						borderBottomWidth: "1px",
						borderColor: "border.subtle",
						gap: "xs",
						children: [
							/* @__PURE__ */ D(_, {
								boxSize: "3.5",
								color: "fg.subtle",
								children: /* @__PURE__ */ D(s, {})
							}),
							/* @__PURE__ */ D(w, {
								textStyle: "label/S/medium",
								children: r("projectSettings.extensionsPanel.automations.title")
							}),
							/* @__PURE__ */ D(w, {
								textStyle: "label/XS",
								color: "fg.subtle",
								marginLeft: "auto",
								children: t
							})
						]
					}), /* @__PURE__ */ D(C, {
						paddingX: "md",
						paddingY: "sm",
						gap: "xs",
						children: n.map((e) => /* @__PURE__ */ O(g, {
							gap: "sm",
							children: [/* @__PURE__ */ O(C, {
								gap: "0",
								flex: "1",
								minW: "0",
								children: [/* @__PURE__ */ D(w, {
									textStyle: "label/S/regular",
									truncate: !0,
									children: l(e.title, e.extensionId)
								}), /* @__PURE__ */ D(w, {
									textStyle: "label/XS",
									fontFamily: "mono",
									color: "fg.subtle",
									truncate: !0,
									children: r("projectSettings.extensionsPanel.automations.cron", { cron: e.cron })
								})]
							}), /* @__PURE__ */ D(w, {
								textStyle: "label/XS",
								fontFamily: "mono",
								color: e.enabled ? "fg.success" : "fg.subtle",
								children: e.enabled ? r("projectSettings.extensionsPanel.automations.stateOn") : r("projectSettings.extensionsPanel.automations.stateOff")
							})]
						}, e.id))
					})]
				})
			})
		}) }) })]
	});
}, j = (e) => e.stopPropagation(), M = (n) => {
	let { extension: o, diagnostics: s, automations: l, unavailableHarnesses: d = [], toggling: f, upgrading: m, onToggle: y, onUpgrade: b, onOpen: x } = n, { t: S } = c("projects");
	return /* @__PURE__ */ O(g, {
		"data-testid": "extension-entry",
		gap: "md",
		paddingX: "lg",
		paddingY: "sm",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		cursor: "pointer",
		role: "button",
		tabIndex: 0,
		_hover: { bg: "bg.subtle" },
		onClick: x,
		onKeyDown: (e) => {
			(e.key === "Enter" || e.key === " ") && x();
		},
		children: [
			/* @__PURE__ */ D(h, {
				alignItems: "center",
				justifyContent: "center",
				boxSize: "9",
				flexShrink: "0",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "sm",
				bg: "bg.subtle",
				color: o.enabled ? "fg" : "fg.subtle",
				children: /* @__PURE__ */ D(a, { size: 18 })
			}),
			/* @__PURE__ */ O(C, {
				gap: "0",
				flex: "1",
				minW: "0",
				children: [/* @__PURE__ */ O(g, {
					gap: "sm",
					minW: "0",
					children: [/* @__PURE__ */ D(w, {
						textStyle: "label/S/medium",
						color: o.enabled ? "fg" : "fg.muted",
						truncate: !0,
						children: o.displayName
					}), /* @__PURE__ */ O(w, {
						textStyle: "label/XS",
						fontFamily: "mono",
						color: "fg.subtle",
						flexShrink: "0",
						children: [o.extensionId, o.version ? ` · v${o.version}` : ""]
					})]
				}), /* @__PURE__ */ D(w, {
					textStyle: "label/XS",
					color: "fg.muted",
					truncate: !0,
					children: o.description ?? S("projectSettings.extensionsPanel.noDescription")
				})]
			}),
			/* @__PURE__ */ O(g, {
				gap: "2xs",
				w: "72px",
				flexShrink: "0",
				color: "fg.subtle",
				children: [/* @__PURE__ */ D(_, {
					boxSize: "3.5",
					children: o.scope === "repo" ? /* @__PURE__ */ D(r, {}) : /* @__PURE__ */ D(i, {})
				}), /* @__PURE__ */ D(w, {
					textStyle: "label/XS",
					fontFamily: "mono",
					children: S(`projectSettings.extensionsPanel.scope.${o.scope}`)
				})]
			}),
			/* @__PURE__ */ D(p, {
				w: "64px",
				flexShrink: "0",
				display: "flex",
				justifyContent: "flex-start",
				onClick: j,
				"data-testid": "extension-automation-status",
				children: /* @__PURE__ */ D(A, {
					extensionName: o.displayName,
					automations: l
				})
			}),
			/* @__PURE__ */ D(p, {
				w: "52px",
				flexShrink: "0",
				display: "flex",
				justifyContent: "flex-end",
				onClick: j,
				onKeyDown: j,
				children: /* @__PURE__ */ D(u, {
					extension: o,
					diagnostics: s,
					unavailableHarnesses: d,
					upgrading: m,
					onUpgrade: b
				})
			}),
			/* @__PURE__ */ D(p, {
				boxSize: "6",
				flexShrink: "0",
				onClick: j,
				onKeyDown: j,
				children: o.canUpgrade && /* @__PURE__ */ D(E, {
					content: S("projectSettings.extensionsPanel.upgrade.action"),
					children: /* @__PURE__ */ D(v, {
						variant: "ghost",
						size: "2xs",
						loading: m,
						onClick: b,
						"aria-label": S("projectSettings.extensionsPanel.upgrade.action"),
						"data-testid": "extension-row-upgrade",
						children: /* @__PURE__ */ D(t, {})
					})
				})
			}),
			/* @__PURE__ */ D(E, {
				content: S("projectSettings.extensionsPanel.enabledInProject"),
				children: /* @__PURE__ */ D(p, {
					flexShrink: "0",
					onClick: j,
					children: /* @__PURE__ */ D(T, {
						size: "sm",
						checked: o.enabled,
						onCheckedChange: (e) => {
							y(e.checked);
						},
						disabled: f,
						"aria-label": S("projectSettings.extensionsPanel.toggleAriaLabel", { name: o.displayName })
					})
				})
			}),
			/* @__PURE__ */ D(_, {
				boxSize: "4",
				color: "fg.subtle",
				flexShrink: "0",
				children: /* @__PURE__ */ D(e, {})
			})
		]
	});
}, N = (t) => {
	let { extension: r, installing: i, onInstall: o, onOpen: s } = t, { t: l } = c("projects");
	return /* @__PURE__ */ O(g, {
		"data-testid": "marketplace-extension-entry",
		gap: "md",
		paddingX: "lg",
		paddingY: "sm",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		cursor: "pointer",
		role: "button",
		tabIndex: 0,
		_hover: { bg: "bg.subtle" },
		onClick: s,
		onKeyDown: (e) => {
			e.currentTarget === e.target && (e.key === "Enter" || e.key === " ") && s();
		},
		children: [
			/* @__PURE__ */ D(h, {
				alignItems: "center",
				justifyContent: "center",
				boxSize: "9",
				flexShrink: "0",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "sm",
				bg: "bg.subtle",
				color: "fg.subtle",
				children: /* @__PURE__ */ D(a, { size: 18 })
			}),
			/* @__PURE__ */ O(C, {
				gap: "0",
				flex: "1",
				minW: "0",
				children: [
					/* @__PURE__ */ O(g, {
						gap: "sm",
						minW: "0",
						children: [/* @__PURE__ */ D(w, {
							textStyle: "label/S/medium",
							truncate: !0,
							children: r.displayName
						}), /* @__PURE__ */ D(w, {
							textStyle: "label/XS",
							fontFamily: "mono",
							color: "fg.subtle",
							flexShrink: "0",
							children: r.installName
						})]
					}),
					/* @__PURE__ */ D(w, {
						textStyle: "label/XS",
						color: "fg.muted",
						truncate: !0,
						children: r.description
					}),
					/* @__PURE__ */ O(w, {
						textStyle: "label/XS",
						color: "fg.subtle",
						fontFamily: "mono",
						truncate: !0,
						children: [
							r.publisher ? `${r.publisher} · ` : "",
							r.origin.url,
							"@",
							r.origin.ref,
							"#",
							r.origin.path
						]
					})
				]
			}),
			/* @__PURE__ */ O(m, {
				variant: "outline",
				size: "2xs",
				loading: i,
				onClick: (e) => {
					e.stopPropagation(), o();
				},
				"data-testid": "marketplace-extension-install",
				children: [/* @__PURE__ */ D(n, { size: 12 }), l("projectSettings.extensionsPanel.marketplace.install")]
			}),
			/* @__PURE__ */ D(_, {
				boxSize: "4",
				color: "fg.subtle",
				flexShrink: "0",
				children: /* @__PURE__ */ D(e, {})
			})
		]
	});
}, P = (e, t) => {
	let n = new Set(e.map((e) => e.extensionId)), r = /* @__PURE__ */ new Map();
	for (let e of t) {
		if (!e.extensionId || !n.has(e.extensionId)) continue;
		let t = r.get(e.extensionId) ?? [];
		t.push(e), r.set(e.extensionId, t);
	}
	return r;
}, F = (e, t) => {
	let n = t.trim().toLowerCase();
	return !n || [
		e.displayName,
		e.extensionId,
		e.description ?? ""
	].some((e) => e.toLowerCase().includes(n));
}, I = (e, t) => {
	let n = t.trim().toLowerCase();
	return !n || [
		e.displayName,
		e.installName,
		e.description
	].some((e) => e.toLowerCase().includes(n));
}, L = (e) => {
	let { extensions: n, marketplace: r, diagnostics: i, automations: a, harnesses: s, agents: l, togglingInstanceId: u, upgradingInstanceIds: p = [], installingMarketplaceNames: h = [], onToggle: _, onUpgrade: v, onOpen: x, onInstallMarketplace: S, onOpenMarketplace: T, upgradingAll: E, onUpgradeAll: A, addingFolderName: j, onDropFolder: L } = e, { t: R } = c("projects"), [z, B] = f(""), V = P(n, i), H = n.filter((e) => F(e, z)), U = r.filter((e) => !e.installed), W = U.filter((e) => I(e, z)), G = new Set(h), K = n.filter((e) => e.canUpgrade);
	return /* @__PURE__ */ O(C, {
		gap: "0",
		"data-testid": "extensions-panel",
		children: [
			/* @__PURE__ */ D(C, {
				paddingX: "lg",
				paddingTop: "lg",
				paddingBottom: "md",
				gap: "sm",
				bg: "bg",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				position: "sticky",
				top: "0",
				zIndex: "1",
				children: /* @__PURE__ */ O(g, {
					gap: "md",
					alignItems: "center",
					children: [
						/* @__PURE__ */ D(w, {
							textStyle: "heading/M",
							flex: "1",
							minW: "0",
							children: R("projectSettings.extensionsPanel.title")
						}),
						K.length > 0 && /* @__PURE__ */ O(m, {
							variant: "primary",
							size: "sm",
							flexShrink: "0",
							loading: E,
							onClick: () => A?.(K),
							"data-testid": "extensions-upgrade-all",
							children: [/* @__PURE__ */ D(t, { size: 14 }), R("projectSettings.extensionsPanel.upgradeAll.action")]
						}),
						/* @__PURE__ */ D(b, {
							startElement: /* @__PURE__ */ D(o, { size: 14 }),
							width: "260px",
							children: /* @__PURE__ */ D(y, {
								size: "sm",
								value: z,
								placeholder: R("projectSettings.extensionsPanel.searchPlaceholder"),
								"aria-label": R("projectSettings.extensionsPanel.searchPlaceholder"),
								onChange: (e) => B(e.target.value),
								"data-testid": "extensions-search"
							})
						})
					]
				})
			}),
			/* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingTop: "md",
				paddingBottom: "2xs",
				textStyle: "label/XS/medium",
				color: "fg.subtle",
				children: R("projectSettings.extensionsPanel.installedGroup", { count: n.length })
			}),
			n.length === 0 && /* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingY: "md",
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				"data-testid": "extensions-empty",
				children: R("projectSettings.extensionsPanel.empty")
			}),
			n.length > 0 && H.length === 0 && /* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingY: "md",
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: R("projectSettings.extensionsPanel.noSearchResults", { query: z })
			}),
			H.map((e) => /* @__PURE__ */ D(M, {
				extension: e,
				diagnostics: V.get(e.extensionId) ?? [],
				automations: a.filter((t) => t.extensionId === e.extensionId),
				unavailableHarnesses: k(e, s, l),
				toggling: u === e.id,
				upgrading: p.includes(e.id),
				onToggle: (t) => _?.(e, t),
				onUpgrade: () => v?.(e),
				onOpen: () => x?.(e)
			}, e.id)),
			/* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingTop: "md",
				paddingBottom: "2xs",
				textStyle: "label/XS/medium",
				color: "fg.subtle",
				children: R("projectSettings.extensionsPanel.marketplace.group", { count: U.length })
			}),
			U.length === 0 && /* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingY: "md",
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: R("projectSettings.extensionsPanel.marketplace.allInstalled")
			}),
			U.length > 0 && W.length === 0 && /* @__PURE__ */ D(w, {
				paddingX: "lg",
				paddingY: "md",
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: R("projectSettings.extensionsPanel.noSearchResults", { query: z })
			}),
			W.map((e) => /* @__PURE__ */ D(N, {
				extension: e,
				installing: G.has(e.installName),
				onInstall: () => S?.(e),
				onOpen: () => T?.(e)
			}, e.installName)),
			/* @__PURE__ */ D(C, {
				padding: "lg",
				children: /* @__PURE__ */ D(d, {
					addingName: j,
					onDropFolder: (e) => L?.(e)
				})
			})
		]
	});
};
export { k as n, L as t };
