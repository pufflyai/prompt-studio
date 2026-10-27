// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-left-DwicprnJ.ts";
import { t } from "./blocks-C5COKy0k.ts";
import { t as n } from "./circle-arrow-up-C11LjouQ.ts";
import { t as r } from "./copy-COTDVt4R.ts";
import { t as i } from "./puzzle-BKD3K9Fw.ts";
import { t as a } from "./rotate-cw-CtPFKnKz.ts";
import { t as o } from "./sliders-horizontal-0NDBIxRS.ts";
import { t as s } from "./timer-B6AbcL3H.ts";
import { t as c } from "./trash-2-C03vrbuo.ts";
import { t as l } from "./useTranslation-DvWg4zeU.ts";
import { t as u } from "./extension-localization-BwKrr4Fv.ts";
import { t as d } from "./extension-contributions-8fz6OVc3.ts";
import { t as ee } from "./extension-connections-card-CeO4mVOB.ts";
import { n as f, r as p, t as m } from "./extension-health-popover-CKJTh5RS.ts";
import { n as h, t as g } from "./extension-settings-form-CPEAyYcV.ts";
import { Button as _, Flex as v, HStack as y, Icon as b, Separator as x, Stack as S, Tabs as C, Text as w } from "@chakra-ui/react";
import { AlertMessage as T, EmptyState as E, Switch as D, toaster as O } from "@pstdio/ui";
import { jsx as k, jsxs as A } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-detail-health.tsx
var j = (e) => {
	let { extension: t, upgrading: i, onUpgrade: a } = e, { t: o } = l("projects"), s = p(t.lastError, "code"), c = s === "extension_manifest_unsupported_api_version", u = async () => {
		await navigator.clipboard.writeText(f(t.lastError)), O.create({
			type: "success",
			title: o("projectSettings.extensionsPanel.health.errorCopied")
		});
	};
	return /* @__PURE__ */ A(T, {
		status: "error",
		title: c ? o("projectSettings.extensionsPanel.health.incompatibleVersions") : s ?? o("projectSettings.extensionsPanel.status.error"),
		"data-testid": "extension-detail-health",
		endElement: /* @__PURE__ */ A(y, {
			gap: "2xs",
			justifyContent: "flex-end",
			flexWrap: "wrap",
			minW: "0",
			children: [t.canUpgrade && /* @__PURE__ */ A(_, {
				onClick: a,
				loading: i,
				"data-testid": "extension-health-upgrade",
				children: [/* @__PURE__ */ k(n, { size: 12 }), o("projectSettings.extensionsPanel.upgrade.action")]
			}), /* @__PURE__ */ A(_, {
				onClick: () => void u(),
				"data-testid": "extension-copy-error",
				children: [/* @__PURE__ */ k(r, { size: 12 }), o("projectSettings.extensionsPanel.health.copyError")]
			})]
		}),
		children: [p(t.lastError, "message") ?? o("projectSettings.extensionsPanel.health.unknownError"), t.lastLoadedAt ? ` · ${o("projectSettings.extensionsPanel.health.lastLoaded", { time: new Date(t.lastLoadedAt).toLocaleString() })}` : ""]
	});
}, M = (r) => {
	let { extension: f, projectId: p, metadata: O, automations: M, diagnostics: N, unavailableHarnesses: P = [], settings: F, settingsViews: I, toggling: L, reloading: R, upgrading: z, uninstalling: B, togglingAutomationId: V, onBack: H, onToggle: U, onToggleAutomation: W, executeOptionCommand: G, onChangeSetting: K, onReload: q, onUpgrade: J, onUninstall: Y } = r, { t: X } = l("projects"), Z = f.status === "error", Q = !f.canUpgrade && f.updateAvailable, te = N.some((e) => e.severity === "error"), $ = h(F).length > 0, ne = !!I;
	return /* @__PURE__ */ A(S, {
		gap: "md",
		paddingBottom: "lg",
		"data-testid": "extension-detail",
		children: [/* @__PURE__ */ A(S, {
			gap: "md",
			paddingX: "lg",
			paddingTop: "lg",
			children: [
				/* @__PURE__ */ A(y, {
					justifyContent: "space-between",
					children: [/* @__PURE__ */ A(_, {
						variant: "ghost",
						size: "2xs",
						onClick: H,
						"data-testid": "extension-detail-back",
						children: [/* @__PURE__ */ k(e, { size: 12 }), X("projectSettings.extensionsPanel.detail.back")]
					}), P.length > 0 && /* @__PURE__ */ k(m, {
						extension: f,
						diagnostics: N,
						unavailableHarnesses: P,
						upgrading: z,
						onUpgrade: J
					})]
				}),
				/* @__PURE__ */ A(y, {
					gap: "md",
					alignItems: "center",
					children: [
						/* @__PURE__ */ k(v, {
							alignItems: "center",
							justifyContent: "center",
							boxSize: "11",
							flexShrink: "0",
							borderWidth: "1px",
							borderColor: "border.subtle",
							borderRadius: "sm",
							bg: "bg.subtle",
							children: /* @__PURE__ */ k(i, { size: 22 })
						}),
						/* @__PURE__ */ A(S, {
							gap: "0",
							flex: "1",
							minW: "0",
							children: [/* @__PURE__ */ k(w, {
								textStyle: "heading/M",
								children: f.displayName
							}), /* @__PURE__ */ A(w, {
								textStyle: "label/XS",
								fontFamily: "mono",
								color: "fg.subtle",
								children: [
									f.extensionId,
									f.version ? ` · v${f.version}` : "",
									" ·",
									" ",
									X(`projectSettings.extensionsPanel.scope.${f.scope}`)
								]
							})]
						}),
						f.canUpgrade && /* @__PURE__ */ A(_, {
							variant: "primary",
							size: "2xs",
							onClick: J,
							loading: z,
							"data-testid": "extension-upgrade",
							flexShrink: "0",
							children: [/* @__PURE__ */ k(n, { size: 12 }), X("projectSettings.extensionsPanel.upgrade.action")]
						}),
						Q && /* @__PURE__ */ A(_, {
							variant: "primary",
							size: "2xs",
							onClick: q,
							loading: R,
							"data-testid": "extension-reload",
							flexShrink: "0",
							children: [/* @__PURE__ */ k(a, { size: 12 }), X("projectSettings.extensionsPanel.reload.action")]
						}),
						/* @__PURE__ */ k(D, {
							size: "sm",
							checked: f.enabled,
							onCheckedChange: (e) => {
								U(e.checked);
							},
							disabled: L || B,
							"aria-label": X("projectSettings.extensionsPanel.toggleAriaLabel", { name: f.displayName }),
							children: X("projectSettings.extensionsPanel.enabledInProject")
						})
					]
				}),
				f.description && /* @__PURE__ */ k(w, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: f.description
				}),
				Q && /* @__PURE__ */ k(w, {
					textStyle: "label/XS",
					color: "fg.muted",
					"data-testid": "extension-reload-hint",
					children: X("projectSettings.extensionsPanel.reload.hint")
				}),
				/* @__PURE__ */ A(S, {
					gap: "3xs",
					children: [/* @__PURE__ */ k(w, {
						textStyle: "label/XS",
						color: "fg.subtle",
						children: X("projectSettings.extensionsPanel.detail.sourcePath")
					}), /* @__PURE__ */ k(w, {
						textStyle: "label/XS",
						fontFamily: "mono",
						color: "fg.muted",
						wordBreak: "break-all",
						"data-testid": "extension-detail-source-path",
						children: f.sourcePath
					})]
				}),
				Z && /* @__PURE__ */ k(j, {
					extension: f,
					upgrading: z,
					onUpgrade: J
				}),
				!Z && N.length > 0 && /* @__PURE__ */ k(T, {
					status: te ? "error" : "warning",
					title: X("projectSettings.extensionsPanel.health.issues", { count: N.length }),
					"data-testid": "extension-detail-issues",
					children: N.slice(0, 4).map((e, t) => /* @__PURE__ */ A(w, {
						textStyle: "label/XS",
						children: [
							e.code,
							": ",
							e.message
						]
					}, `${e.code}-${t}`))
				})
			]
		}), /* @__PURE__ */ A(C.Root, {
			defaultValue: "settings",
			size: "sm",
			tray: !0,
			children: [
				/* @__PURE__ */ A(C.List, { children: [/* @__PURE__ */ A(C.Trigger, {
					value: "settings",
					children: [/* @__PURE__ */ k(o, { size: 14 }), X("projectSettings.extensionsPanel.detail.tabs.settings")]
				}), /* @__PURE__ */ A(C.Trigger, {
					value: "contributions",
					children: [/* @__PURE__ */ k(t, { size: 14 }), X("projectSettings.extensionsPanel.detail.tabs.contributions")]
				})] }),
				/* @__PURE__ */ k(C.Content, {
					value: "settings",
					children: /* @__PURE__ */ A(S, {
						gap: "lg",
						children: [
							/* @__PURE__ */ A(S, {
								gap: "lg",
								paddingX: "lg",
								children: [
									$ ? /* @__PURE__ */ k(g, {
										settings: F,
										executeOptionCommand: G,
										onChangeSetting: K
									}) : null,
									!$ && !ne ? /* @__PURE__ */ k(E, {
										size: "sm",
										title: X("projectSettings.extensionsPanel.detail.noSettings"),
										icon: /* @__PURE__ */ k(o, {})
									}) : null,
									I,
									p && O?.connections?.length ? /* @__PURE__ */ k(ee, {
										projectId: p,
										definitions: O.connections
									}) : null,
									M.length > 0 && /* @__PURE__ */ A(S, {
										gap: "2xs",
										children: [/* @__PURE__ */ A(y, {
											gap: "2xs",
											children: [/* @__PURE__ */ k(b, {
												boxSize: "3",
												color: "fg.subtle",
												children: /* @__PURE__ */ k(s, {})
											}), /* @__PURE__ */ k(w, {
												textStyle: "label/XS/medium",
												color: "fg.subtle",
												textTransform: "uppercase",
												letterSpacing: "0.06em",
												children: X("projectSettings.extensionsPanel.automations.title")
											})]
										}), M.map((e) => /* @__PURE__ */ A(y, {
											gap: "md",
											minH: "7",
											"data-testid": "extension-automation-row",
											children: [/* @__PURE__ */ A(S, {
												gap: "0",
												flex: "1",
												minW: "0",
												children: [/* @__PURE__ */ k(w, {
													textStyle: "label/S/regular",
													truncate: !0,
													children: u(e.title, e.extensionId)
												}), /* @__PURE__ */ A(w, {
													textStyle: "label/XS",
													fontFamily: "mono",
													color: "fg.subtle",
													truncate: !0,
													children: [
														e.commandId,
														" ·",
														" ",
														X("projectSettings.extensionsPanel.automations.cron", { cron: e.cron })
													]
												})]
											}), /* @__PURE__ */ k(D, {
												size: "sm",
												checked: e.enabled,
												disabled: V === e.id,
												onCheckedChange: (t) => W(e, t.checked),
												"aria-label": X("projectSettings.extensionsPanel.automations.toggleAriaLabel", { name: u(e.title, e.extensionId) })
											})]
										}, e.id))]
									})
								]
							}),
							/* @__PURE__ */ k(x, { borderColor: "border.subtle" }),
							/* @__PURE__ */ A(S, {
								gap: "2xs",
								paddingX: "lg",
								children: [/* @__PURE__ */ k(w, {
									textStyle: "label/XS/medium",
									color: "fg.subtle",
									textTransform: "uppercase",
									letterSpacing: "0.06em",
									children: X("projectSettings.extensionsPanel.detail.dangerZone")
								}), /* @__PURE__ */ A(y, {
									justifyContent: "space-between",
									children: [/* @__PURE__ */ k(w, {
										textStyle: "label/XS",
										color: "fg.muted",
										children: X(f.scope === "global" ? "projectSettings.extensionsPanel.detail.deleteHintShared" : "projectSettings.extensionsPanel.detail.deleteHint")
									}), /* @__PURE__ */ A(_, {
										variant: "destructive",
										size: "2xs",
										onClick: Y,
										loading: B,
										"data-testid": "extension-delete",
										children: [/* @__PURE__ */ k(c, { size: 12 }), X("projectSettings.extensionsPanel.delete")]
									})]
								})]
							})
						]
					})
				}),
				/* @__PURE__ */ k(C.Content, {
					value: "contributions",
					children: /* @__PURE__ */ k(S, {
						paddingX: "lg",
						children: /* @__PURE__ */ k(d, {
							metadata: O,
							extensionId: f.extensionId,
							automations: M
						})
					})
				})
			]
		})]
	});
};
export { M as t };
