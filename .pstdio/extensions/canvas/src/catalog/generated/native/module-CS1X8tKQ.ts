// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useMutation-Dy9eufiq.ts";
import { n as r, t as i } from "./workspace-providers-OzFU0iXu.ts";
import { t as a } from "./trash-2-C03vrbuo.ts";
import { t as o } from "./triangle-alert-DcqN2fDE.ts";
import { t as s } from "./useTranslation-DvWg4zeU.ts";
import { _ as c } from "./workbench-core-N58OeDyx.ts";
import { r as l } from "./mode-chrome-D8eccNh1.ts";
import { t as u } from "./resource-icons-CZFS6OM4.ts";
import { t as d } from "./settings-module-AIuYqymV.ts";
import { t as f } from "./appearance-settings-panel-BOchMkUC.ts";
import { t as p } from "./settings-resources-BmVO5oBi.ts";
import { l as m } from "./collections-W65OWXaL.ts";
import { t as h } from "./use-project-CXUANpD-.ts";
import { n as g } from "./api-D3Fkqs7r.ts";
import { r as _ } from "./workbench-extension-contributions-C_CIJIkp.ts";
import { i as v, r as y, t as b } from "./synced-settings-DHQMAu8t.ts";
import { a as x, i as S, s as C } from "./project-context-BR7AjHlE.ts";
import { n as w, t as T } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as E } from "./commands-Bp5w85f4.ts";
import { t as ee } from "./use-agents-xw128NHi.ts";
import { t as D } from "./use-action-error-DjeAuY1I.ts";
import { a as O, c as k, d as A, f as j, g as M, h as N, i as te, l as ne, m as re, n as ie, o as ae, p as oe, s as se, t as ce, u as le } from "./api-CEi0FXP5.ts";
import "./extension-webview-broadcast-CNLWiQaR.ts";
import { t as ue } from "./available-extension-detail-DTSFrqPz.ts";
import { t as de } from "./extension-detail-DMYtKqfR.ts";
import { n as fe, t as pe } from "./extensions-panel-view-C4yJ1rIF.ts";
import { t as me } from "./extension-replacement-confirmation-CbiiFIhY.ts";
import { t as he } from "./machine-tokens-panel-Cqp8uXSn.ts";
import { t as ge } from "./folder-picker-C0Gub-mY.ts";
import { t as _e } from "./project-setup-status-CO0VswgG.ts";
import { n as ve, t as ye } from "./project-defaults-card-DTqw0bBA.ts";
import { a as be, i as xe, n as Se, r as Ce, t as we } from "./template-provider-api-NLcTDJc8.ts";
import { n as Te } from "./skills-api-BmZGdBXb.ts";
import { Suspense as Ee, lazy as De, useEffect as P, useState as F, useSyncExternalStore as Oe } from "react";
import { Box as I, Button as L, Card as R, Dialog as z, Flex as ke, HStack as B, Icon as Ae, Input as je, Spinner as V, Stack as H, Text as U, Textarea as Me } from "@chakra-ui/react";
import { Checkbox as Ne, DeleteConfirmationModal as W, Switch as Pe, toaster as G } from "@pstdio/ui";
import { Fragment as K, jsx as q, jsxs as J } from "react/jsx-runtime";
import { PstdioApiError as Fe } from "@pstdio/sdk/client";
// packages/pstdio-dashboard/src/shared/workbench/disposable.ts
var Ie = (e) => e ? (Array.isArray(e) ? e : [e]).filter((e) => typeof e?.dispose == "function") : [], Le = () => g().settings.get(), Re = (e) => g().settings.update(e), ze = () => {
	let e = Oe(m, y, y), n = t({
		queryKey: ["settings"],
		queryFn: async () => {
			let e = await Le();
			return y() || v(e), null;
		}
	});
	return {
		...n,
		data: e,
		isLoading: !e && n.isLoading
	};
}, Be = () => n({
	mutationFn: (e) => Re(e),
	onSuccess: v
}), Ve = (e) => {
	let { settings: t, saving: n, error: r, onChange: i, onRetry: a } = e, { t: o } = s("settings"), c = [{
		key: "notifications_enabled",
		label: o("betaFeatures.notifications")
	}, {
		key: "machine_tokens_enabled",
		label: o("betaFeatures.machineTokens")
	}];
	return /* @__PURE__ */ J(H, {
		gap: "md",
		padding: "lg",
		children: [
			/* @__PURE__ */ J(H, {
				gap: "2xs",
				children: [/* @__PURE__ */ q(U, {
					textStyle: "heading/S",
					children: o("betaFeatures.title")
				}), /* @__PURE__ */ q(U, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: o("betaFeatures.description")
				})]
			}),
			c.map((e) => {
				let r = t?.[e.key] === !0;
				return /* @__PURE__ */ q(Pe, {
					checked: r,
					inputProps: { checked: r },
					disabled: !t || n,
					onCheckedChange: (t) => i({ [e.key]: t.checked }),
					children: e.label
				}, e.key);
			}),
			!t && !r ? /* @__PURE__ */ q(U, {
				color: "fg.muted",
				children: o("betaFeatures.loading")
			}) : null,
			r ? /* @__PURE__ */ J(H, {
				gap: "sm",
				role: "alert",
				children: [/* @__PURE__ */ q(U, {
					color: "fg.error",
					children: r
				}), /* @__PURE__ */ q(L, {
					variant: "outline",
					alignSelf: "start",
					onClick: a,
					children: o("runtimeSettings.retry")
				})]
			}) : null
		]
	});
}, He = () => {
	let { data: e, error: t, refetch: n } = ze(), r = Be();
	return /* @__PURE__ */ q(Ve, {
		settings: e,
		saving: r.isPending,
		error: (r.error ?? t)?.message,
		onChange: (e) => r.mutate(e),
		onRetry: () => {
			r.reset(), n();
		}
	});
}, Y = (e) => ["project-extensions", e], X = (e) => ["project-extension-metadata", e], Ue = (e, t) => Promise.all([
	i(e, t),
	e.invalidateQueries({ queryKey: Y(t) }),
	e.invalidateQueries({ queryKey: X(t) }),
	e.invalidateQueries({ queryKey: ["extension-contributions", t] }),
	e.invalidateQueries({ queryKey: ["agents-info"] }),
	e.invalidateQueries({ queryKey: ["agent-models"] })
]), We = (e, t, n) => {
	if (!e) return e;
	let r = !1, i = (e.automations ?? []).map((e) => e.id !== t.id || e.extensionInstanceId !== n ? e : (r = !0, t));
	return {
		...e,
		automations: r ? i : [...i, t]
	};
}, Z = (e, t) => {
	let n = () => Promise.all([
		e.cancelQueries({ queryKey: r(t) }),
		e.cancelQueries({ queryKey: Y(t) }),
		e.cancelQueries({ queryKey: X(t) }),
		e.cancelQueries({ queryKey: ["extension-contributions", t] })
	]), i = () => {
		Ue(e, t);
	};
	return {
		removeExtension: async (r) => {
			await n(), e.setQueryData(Y(t), (e) => {
				if (!e) return e;
				let t = e.extensions.find((e) => e.id === r);
				if (!t) return e;
				let n = e.extensions.filter((e) => e.id !== r), i = n.some((e) => e.installName === t.installName);
				return {
					...e,
					extensions: n,
					marketplace: e.marketplace.map((e) => e.installName === t.installName ? {
						...e,
						installed: i
					} : e)
				};
			}), i();
		},
		storeAutomation: async (r, a) => {
			await n();
			let o = [
				"extension-contributions",
				t,
				r
			], s = e.getQueryData(o);
			e.setQueryData(X(t), (e) => We(e && s?.automations ? {
				...e,
				automations: [...(e.automations ?? []).filter((e) => e.extensionInstanceId !== r), ...s.automations]
			} : e, a, r)), e.setQueryData(o, (e) => We(e, a, r)), i();
		},
		storeExtension: async (r) => {
			await n(), e.setQueryData(Y(t), (e) => e && {
				...e,
				extensions: [...e.extensions.filter((e) => e.id !== r.id), r],
				marketplace: e.marketplace.map((e) => e.installName === r.installName ? {
					...e,
					installed: !0
				} : e)
			}), i();
		}
	};
}, Ge = (e) => t({
	queryKey: X(e),
	queryFn: () => se(e),
	enabled: !!e
}), Ke = (e) => t({
	queryKey: Y(e),
	queryFn: () => le(e),
	enabled: !!e
}), qe = (t) => {
	let r = Z(e(), t);
	return n({
		mutationFn: ({ installName: e, force: n }) => {
			if (!t) throw Error("Project id is required to install extensions.");
			return k(t, e, n);
		},
		onSuccess: (e) => r.storeExtension(e.extension)
	});
}, Je = (t) => {
	let r = Z(e(), t);
	return n({
		mutationFn: (e) => {
			if (!t) throw Error("Project id is required to add extensions.");
			return ce(t, e);
		},
		onSuccess: (e) => r.storeExtension(e.extension)
	});
}, Ye = (t) => {
	let r = Z(e(), t);
	return n({
		mutationFn: ({ instanceId: e, enabled: n }) => {
			if (!t) throw Error("Project id is required to update extensions.");
			return oe(t, e, n);
		},
		onSuccess: (e) => r.storeExtension(e)
	});
}, Xe = (t) => {
	let r = Z(e(), t);
	return n({
		mutationFn: ({ instanceId: e, automationId: n, enabled: r }) => {
			if (!t) throw Error("Project id is required to update automations.");
			return j(t, e, n, r);
		},
		onSuccess: (e, t) => r.storeAutomation(t.instanceId, e)
	});
}, Ze = (t) => {
	let r = e();
	return n({
		mutationFn: ({ instanceId: e }) => {
			if (!t) throw Error("Project id is required to reload extensions.");
			return A(t, e);
		},
		onSuccess: () => {
			Ue(r, t);
		}
	});
}, Qe = (t) => {
	let r = e();
	return n({
		mutationFn: ({ instanceId: e }) => {
			if (!t) throw Error("Project id is required to upgrade extensions.");
			return M(t, e);
		},
		onSuccess: () => {
			Ue(r, t);
		}
	});
}, $e = (e, n) => t({
	queryKey: [
		"extension-contributions",
		e,
		n
	],
	queryFn: () => O(e, n),
	enabled: !!(e && n)
}), et = (e, n) => t({
	queryKey: [
		"marketplace-extension-contributions",
		e,
		n
	],
	queryFn: () => ae(e, n),
	enabled: !!(e && n)
}), tt = (e, t) => [
	"project-extension-settings",
	e,
	t
], nt = (e, n) => t({
	queryKey: tt(e, n),
	queryFn: () => ne(e, n),
	enabled: !!(e && n)
}), rt = (t) => {
	let r = e();
	return n({
		mutationFn: async ({ instanceId: e, key: n, value: r }) => {
			if (!t) throw Error("Project id is required to update extension settings.");
			return r === void 0 ? ie(t, e, n) : N(t, e, n, r);
		},
		onSuccess: (e, n) => {
			r.invalidateQueries({ queryKey: tt(t, n.instanceId) });
		}
	});
}, it = (t) => {
	let r = Z(e(), t);
	return n({
		mutationFn: ({ instanceId: e, deleteUserData: n }) => {
			if (!t) throw Error("Project id is required to uninstall extensions.");
			return re(t, e, n);
		},
		onSuccess: (e, t) => r.removeExtension(t.instanceId)
	});
};
// packages/pstdio-dashboard/src/modules/settings/components/extension-settings-views.tsx
function at(e) {
	let { input: t, panels: n } = e;
	return /* @__PURE__ */ q(H, {
		gap: "lg",
		children: n.map((e) => /* @__PURE__ */ q(I, {
			minH: "0",
			display: "flex",
			children: /* @__PURE__ */ q(l, {
				workbench: t.workbench,
				placement: {
					widgetId: `${t.instance.instanceId}:${e.id}`,
					contributionId: e.id,
					viewId: `${e.view.extensionId}.view.${e.view.id}`,
					ownerId: e.extensionId
				}
			})
		}, e.id))
	});
}
// packages/pstdio-dashboard/src/modules/settings/components/extension-detail-container.tsx
var ot = (e) => {
	let { projectId: t, extension: n, metadata: r, agents: i, onBack: a, settingsInput: o } = e, { showError: c, errorNotice: l, clearError: u } = D(), d = r?.settingsPanels.filter((e) => e.extensionId === n.extensionId && e.slot.id === "extension.settings") ?? [], { t: f } = s("projects"), p = Ye(t), m = Xe(t), h = nt(t, n.id), g = $e(t, n.id), _ = rt(t), v = Ze(t), y = Qe(t), b = it(t), [x, S] = F(!1), [C, w] = F(!1), T = g.data, E = (T?.automations ?? []).filter((e) => e.extensionId === n.extensionId), ee = (r?.diagnostics ?? []).filter((e) => e.extensionId === n.extensionId);
	return /* @__PURE__ */ J(K, { children: [
		!x && l,
		/* @__PURE__ */ q(de, {
			projectId: t,
			extension: n,
			metadata: T,
			unavailableHarnesses: fe(n, g.isSuccess ? T?.harnesses : void 0, i),
			automations: E,
			diagnostics: ee,
			settings: h.data?.settings ?? [],
			settingsViews: o && d.length ? /* @__PURE__ */ q(at, {
				input: o,
				panels: d
			}) : void 0,
			toggling: p.isPending,
			reloading: v.isPending,
			upgrading: y.isPending,
			uninstalling: b.isPending,
			togglingAutomationId: m.isPending ? m.variables?.automationId ?? void 0 : void 0,
			onBack: a,
			onToggle: (e) => {
				u(), p.mutate({
					instanceId: n.id,
					enabled: e
				}, { onError: (e) => c({ title: e.message }) });
			},
			onToggleAutomation: (e, t) => m.mutate({
				instanceId: n.id,
				automationId: e.id,
				enabled: t
			}, { onError: (e) => c({ title: e.message }) }),
			executeOptionCommand: (e, n, r) => t ? te(t, e, n, r) : Promise.reject(/* @__PURE__ */ Error("Setting options need a project.")),
			onChangeSetting: (e, t) => {
				u(), _.mutate({
					instanceId: n.id,
					key: e,
					value: t
				}, { onError: (e) => c({ title: e.message }) });
			},
			onReload: () => {
				u(), v.mutate({ instanceId: n.id }, {
					onSuccess: (e) => {
						e.status === "loaded" ? G.create({
							type: "success",
							title: f("projectSettings.extensionsPanel.reload.succeeded")
						}) : c({ title: f("projectSettings.extensionsPanel.reload.failed") });
					},
					onError: (e) => c({
						title: f("projectSettings.extensionsPanel.reload.failed"),
						description: e.message
					})
				});
			},
			onUpgrade: () => {
				u(), y.mutate({ instanceId: n.id }, {
					onSuccess: (e) => {
						G.create({
							type: "success",
							title: f(e.changed ? "projectSettings.extensionsPanel.upgrade.succeeded" : "projectSettings.extensionsPanel.upgrade.current")
						});
					},
					onError: (e) => {
						c({
							title: f("projectSettings.extensionsPanel.upgrade.failed"),
							description: e instanceof Error ? e.message : void 0
						});
					}
				});
			},
			onUninstall: () => {
				u(), S(!0);
			}
		}),
		/* @__PURE__ */ J(W, {
			open: x,
			onClose: () => {
				S(!1), w(!1);
			},
			onDelete: async () => {
				u();
				try {
					await b.mutateAsync({
						instanceId: n.id,
						deleteUserData: C
					}), a();
				} catch (e) {
					throw c({
						title: f("projectSettings.extensionsPanel.deleteErrorTitle"),
						description: e instanceof Error ? e.message : f("projectSettings.extensionsPanel.deleteError")
					}), e;
				}
			},
			headline: f("projectSettings.extensionsPanel.deleteConfirm.headline"),
			notificationText: f(n.scope === "global" ? "projectSettings.extensionsPanel.deleteConfirm.notificationShared" : "projectSettings.extensionsPanel.deleteConfirm.notification", { name: n.displayName }),
			buttonText: f("projectSettings.extensionsPanel.deleteConfirm.button"),
			children: [l, /* @__PURE__ */ q(Ne, {
				checked: C,
				onCheckedChange: (e) => w(e.checked === !0),
				children: f("projectSettings.extensionsPanel.deleteConfirm.deleteDataLabel")
			})]
		})
	] });
}, st = (e) => {
	let { projectId: t, settingsInput: n } = e, { showError: r, errorNotice: i, clearError: a } = D(), { t: o } = s("projects"), c = Ke(t), l = Ge(t), u = ee(t), d = t && u.isSuccess ? u.data : void 0, f = Ye(t), p = Qe(t), m = qe(t), h = Je(t), [g, _] = F(null), v = /* @__PURE__ */ q(me, {
		replacement: g,
		onClose: () => _(null)
	}), [y, b] = F(null), [x, S] = F(null), [C, w] = F([]), [T, E] = F([]), O = et(t, x ?? void 0);
	if (c.isLoading) return /* @__PURE__ */ q(ke, {
		flex: "1",
		justifyContent: "center",
		alignItems: "center",
		padding: "lg",
		children: /* @__PURE__ */ q(V, {})
	});
	if (c.error) return /* @__PURE__ */ q(H, {
		padding: "lg",
		gap: "lg",
		children: /* @__PURE__ */ q(U, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: c.error instanceof Error ? c.error.message : o("projectSettings.extensionsPanel.loadError")
		})
	});
	let k = c.data?.extensions ?? [], A = c.data?.marketplace ?? [], j = k.find((e) => e.id === y), M = A.find((e) => e.installName === x && !e.installed), N = async (e, t = !1) => {
		a(), w((t) => [.../* @__PURE__ */ new Set([...t, e.installName])]);
		try {
			await m.mutateAsync({
				installName: e.installName,
				force: t
			}), G.create({
				type: "success",
				title: o("projectSettings.extensionsPanel.marketplace.installSucceeded", { name: e.displayName })
			}), x === e.installName && S(null);
		} catch (n) {
			if (n instanceof Fe && n.code === "extension_already_installed" && !t) {
				_({
					name: e.displayName,
					retry: () => N(e, !0)
				});
				return;
			}
			r({
				title: o("projectSettings.extensionsPanel.marketplace.installFailed"),
				description: n instanceof Error ? n.message : void 0
			});
		} finally {
			w((t) => t.filter((t) => t !== e.installName));
		}
	};
	if (j) return /* @__PURE__ */ q(ot, {
		projectId: t,
		extension: j,
		metadata: l.data,
		agents: d,
		settingsInput: n,
		onBack: () => b(null)
	});
	if (M) return /* @__PURE__ */ J(K, { children: [
		v,
		i,
		/* @__PURE__ */ q(ue, {
			extension: M,
			metadata: O.data,
			contributionsError: O.error instanceof Error ? O.error.message : void 0,
			loadingContributions: O.isLoading,
			installing: C.includes(M.installName),
			onBack: () => S(null),
			onInstall: () => void N(M)
		})
	] });
	let te = (e, t) => {
		a(), f.mutate({
			instanceId: e.id,
			enabled: t
		}, { onError: (e) => {
			r({
				title: o("projectSettings.extensionsPanel.toggleErrorTitle"),
				description: e instanceof Error ? e.message : o("projectSettings.extensionsPanel.toggleError")
			});
		} });
	}, ne = async (e) => {
		a(), E((t) => [.../* @__PURE__ */ new Set([...t, ...e.map((e) => e.id)])]);
		let t = 0, n = [];
		for (let r of e) try {
			await p.mutateAsync({ instanceId: r.id }), t += 1;
		} catch (e) {
			n.push(`${r.displayName}: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			E((e) => e.filter((e) => e !== r.id));
		}
		t > 0 && G.create({
			type: "success",
			title: o("projectSettings.extensionsPanel.upgradeAll.succeeded", { count: t })
		}), n.length > 0 && r({
			title: o("projectSettings.extensionsPanel.upgradeAll.failed", { count: n.length }),
			description: n.join("\n")
		});
	}, re = async (e) => {
		a(), E((t) => [.../* @__PURE__ */ new Set([...t, e.id])]);
		try {
			let t = await p.mutateAsync({ instanceId: e.id });
			G.create({
				type: "success",
				title: o(t.changed ? "projectSettings.extensionsPanel.upgrade.succeeded" : "projectSettings.extensionsPanel.upgrade.current")
			});
		} catch (e) {
			r({
				title: o("projectSettings.extensionsPanel.upgrade.failed"),
				description: e instanceof Error ? e.message : void 0
			});
		} finally {
			E((t) => t.filter((t) => t !== e.id));
		}
	}, ie = async (e) => {
		a();
		try {
			let { extension: t } = await h.mutateAsync(e);
			G.create({
				type: "success",
				title: o("projectSettings.extensionsPanel.dropZone.succeeded", { name: t.displayName })
			});
		} catch (t) {
			if (t instanceof Fe && t.code === "extension_already_installed" && !e.force) {
				_({
					name: e.name,
					retry: () => ie({
						...e,
						force: !0
					})
				});
				return;
			}
			r({
				title: o("projectSettings.extensionsPanel.dropZone.failed"),
				description: t instanceof Error ? t.message : void 0
			});
		}
	};
	return /* @__PURE__ */ J(K, { children: [
		v,
		i,
		/* @__PURE__ */ q(pe, {
			extensions: k,
			marketplace: A,
			diagnostics: l.data?.diagnostics ?? [],
			automations: l.data?.automations ?? [],
			harnesses: l.isSuccess ? l.data?.harnesses : void 0,
			agents: d,
			togglingInstanceId: f.isPending ? f.variables?.instanceId ?? void 0 : void 0,
			upgradingInstanceIds: T,
			installingMarketplaceNames: C,
			onToggle: te,
			onUpgrade: (e) => void re(e),
			onOpen: (e) => b(e.id),
			onInstallMarketplace: (e) => void N(e),
			onOpenMarketplace: (e) => S(e.installName),
			upgradingAll: k.some((e) => e.canUpgrade && T.includes(e.id)),
			onUpgradeAll: (e) => void ne(e),
			addingFolderName: h.isPending ? h.variables?.name : void 0,
			onDropFolder: (e) => void ie(e)
		})
	] });
}, ct = (e) => {
	let { projectId: t, projectName: r, onDeleted: i } = e, { showError: a, errorNotice: s, clearError: c } = D(), l = n({ mutationFn: async (e) => {
		await g().projects.delete(e.projectId);
	} }), [u, d] = F(!1), f = !!t && !l.isPending;
	return /* @__PURE__ */ J(K, { children: [/* @__PURE__ */ q(H, {
		padding: "lg",
		children: /* @__PURE__ */ q(R.Root, {
			size: "sm",
			borderRadius: "0",
			borderColor: "red.300",
			"data-testid": "project-danger-zone-card",
			children: /* @__PURE__ */ q(R.Body, { children: /* @__PURE__ */ J(B, {
				gap: "4",
				alignItems: "flex-start",
				children: [
					/* @__PURE__ */ q(Ae, {
						boxSize: "1em",
						fontSize: "2xl",
						flexShrink: "0",
						color: "red.600",
						children: /* @__PURE__ */ q(o, {})
					}),
					/* @__PURE__ */ q(I, {
						flex: "1",
						minW: "0",
						children: /* @__PURE__ */ J(H, {
							gap: "1",
							children: [/* @__PURE__ */ q(R.Title, {
								textStyle: "sm",
								color: "red.700",
								children: "Danger zone"
							}), /* @__PURE__ */ q(R.Description, {
								color: "red.700",
								children: "Delete this project and all related data. This action cannot be undone."
							})]
						})
					}),
					/* @__PURE__ */ q(L, {
						size: "sm",
						variant: "outline",
						colorPalette: "red",
						flexShrink: "0",
						onClick: () => {
							t && (c(), d(!0));
						},
						disabled: !f,
						children: "Delete project"
					})
				]
			}) })
		})
	}), /* @__PURE__ */ q(W, {
		open: u,
		onClose: () => {
			d(!1);
		},
		onDelete: async () => {
			if (!t) throw Error("Project id is required to delete projects.");
			try {
				await l.mutateAsync({ projectId: t }), G.create({
					type: "success",
					title: "Project deleted",
					description: r
				}), d(!1), i?.();
			} catch (e) {
				let t = e instanceof Error ? e.message : "Unable to delete project.";
				throw a({
					title: "Delete project failed",
					description: t
				}), e;
			}
		},
		headline: "Delete project?",
		notificationText: "This removes the project and all related data.",
		buttonText: "Delete project",
		children: s
	})] });
}, lt = (r) => {
	let { projectId: i } = r, { data: a } = h(i), [o, s] = F(""), [c, l] = F(!1), u = e(), d = ve(i), f = ["project-workspaces", i], p = t({
		queryKey: f,
		queryFn: () => g().workspaces.list(i),
		enabled: !!i
	}), m = p.data?.find((e) => e.is_default);
	P(() => {
		s(a?.name ?? "");
	}, [a?.name]);
	let _ = n({
		mutationFn: (e) => g().projects.attachInitialWorkspace(i, {
			provider_id: "pstdio.root",
			params: { path: e }
		}),
		onSuccess: async () => {
			await u.invalidateQueries({ queryKey: f }), l(!1);
		}
	}), v = n({
		mutationFn: () => g().projects.retrySetup(i),
		onSuccess: async () => {
			await u.invalidateQueries({ queryKey: f });
		}
	}), y = m && m.provider_state !== "ready" && (m.root_path || m.provider_ref_json || m.provider_operation_id) ? m.provider_error_json?.message ?? "The workspace provider has not finished setup. Retry to check its progress." : null, b = v.error?.message ?? m?.setup_error ?? y;
	return /* @__PURE__ */ J(H, {
		padding: "lg",
		gap: "md",
		children: [
			/* @__PURE__ */ q(U, {
				textStyle: "label/S/medium",
				children: "Project name"
			}),
			/* @__PURE__ */ q(je, {
				"aria-label": "Project name",
				value: o,
				onChange: (e) => s(e.target.value)
			}),
			/* @__PURE__ */ q(L, {
				variant: "primary",
				loading: d.isPending,
				disabled: !o.trim() || o === a?.name,
				onClick: () => d.mutate({ name: o.trim() }),
				children: "Save name"
			}),
			d.error && /* @__PURE__ */ q(U, {
				role: "alert",
				color: "fg.error",
				children: d.error.message
			}),
			/* @__PURE__ */ q(U, {
				textStyle: "label/S/medium",
				children: "Project folder"
			}),
			/* @__PURE__ */ q(U, { children: m?.root_path ?? m?.display_path ?? "No workspace attached" }),
			b && /* @__PURE__ */ q(_e, {
				error: b,
				retrying: v.isPending,
				onRetry: () => v.mutate()
			}),
			!m?.root_path && !m?.provider_ref_json && !m?.provider_operation_id && !p.isPending && /* @__PURE__ */ q(L, {
				variant: "outline",
				onClick: () => l(!0),
				children: "Attach project folder"
			}),
			/* @__PURE__ */ J(z.Root, {
				open: c,
				onOpenChange: (e) => l(e.open),
				closeOnInteractOutside: !1,
				lazyMount: !0,
				unmountOnExit: !0,
				children: [/* @__PURE__ */ q(z.Backdrop, {}), /* @__PURE__ */ q(z.Positioner, { children: /* @__PURE__ */ q(z.Content, { children: /* @__PURE__ */ q(ge, {
					isOpening: _.isPending,
					error: _.error?.message,
					onClose: () => l(!1),
					onSelect: async (e) => {
						try {
							await _.mutateAsync(e);
						} catch {}
					}
				}) }) })]
			})
		]
	});
}, ut = (e) => {
	let t = e.trim();
	if (!t) return null;
	let n = Number(t);
	if (!(!Number.isInteger(n) || n < 1)) return n;
}, dt = (e) => {
	let { projectId: t } = e, { showError: n, errorNotice: r, clearError: i } = D(), { t: a } = s("settings"), { data: o, error: c, isError: l, isLoading: u, refetch: d } = ze(), f = Be(), [p, m] = F("");
	P(() => {
		o && m(o.max_concurrent_sessions?.toString() ?? "");
	}, [o]);
	let h = ut(p), g = h === void 0, _ = (o?.max_concurrent_sessions ?? null) === h, v = u || g || _ || f.isPending;
	return /* @__PURE__ */ J(H, {
		gap: "md",
		padding: "lg",
		maxW: "720px",
		children: [
			r,
			/* @__PURE__ */ J(H, {
				gap: "2xs",
				children: [/* @__PURE__ */ q(U, {
					textStyle: "heading/S",
					children: a("runtimeSettings.title")
				}), /* @__PURE__ */ q(U, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: a("runtimeSettings.description")
				})]
			}),
			u ? /* @__PURE__ */ q(I, {
				py: "md",
				display: "flex",
				justifyContent: "center",
				children: /* @__PURE__ */ q(V, { size: "sm" })
			}) : null,
			!u && l ? /* @__PURE__ */ J(H, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "md",
				padding: "md",
				children: [/* @__PURE__ */ J(H, {
					gap: "2xs",
					children: [/* @__PURE__ */ q(U, {
						textStyle: "label/S/medium",
						color: "fg.error",
						children: a("runtimeSettings.loadError")
					}), /* @__PURE__ */ q(U, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: c instanceof Error ? c.message : a("runtimeSettings.loadErrorDescription")
					})]
				}), /* @__PURE__ */ q(L, {
					size: "sm",
					alignSelf: "start",
					variant: "outline",
					onClick: () => d(),
					children: a("runtimeSettings.retry")
				})]
			}) : null,
			!u && !l ? /* @__PURE__ */ J(H, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "md",
				padding: "md",
				children: [/* @__PURE__ */ J(H, {
					gap: "2xs",
					children: [/* @__PURE__ */ q(U, {
						textStyle: "label/S/medium",
						children: a("runtimeSettings.maxConcurrentSessions.label")
					}), /* @__PURE__ */ q(U, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: a("runtimeSettings.maxConcurrentSessions.helper")
					})]
				}), /* @__PURE__ */ J(B, {
					alignItems: "start",
					gap: "sm",
					children: [/* @__PURE__ */ J(H, {
						gap: "2xs",
						flex: "1",
						children: [/* @__PURE__ */ q(je, {
							value: p,
							type: "number",
							min: 1,
							placeholder: a("runtimeSettings.maxConcurrentSessions.placeholder"),
							disabled: f.isPending,
							onChange: (e) => m(e.target.value)
						}), /* @__PURE__ */ q(U, {
							textStyle: "paragraph/XS/regular",
							color: g ? "fg.error" : "fg.muted",
							children: g ? a("runtimeSettings.maxConcurrentSessions.invalid") : a("runtimeSettings.maxConcurrentSessions.current", { value: o?.max_concurrent_sessions == null ? a("runtimeSettings.maxConcurrentSessions.none") : o.max_concurrent_sessions })
						})]
					}), /* @__PURE__ */ q(L, {
						size: "sm",
						onClick: () => {
							h !== void 0 && (i(), f.mutate({ max_concurrent_sessions: h }, {
								onSuccess: () => {
									G.create({
										type: "success",
										title: a("runtimeSettings.saveSuccess")
									});
								},
								onError: (e) => {
									n({
										title: a("runtimeSettings.saveError"),
										description: e.message
									});
								}
							}));
						},
						disabled: v,
						loading: f.isPending,
						children: a("runtimeSettings.save")
					})]
				})]
			}) : null,
			t ? /* @__PURE__ */ q(ye, { projectId: t }) : null
		]
	});
}, ft = (e) => [
	"project-template",
	e.projectId,
	e.id
], pt = (e) => t({
	queryKey: ft(e),
	queryFn: () => Se(e)
}), mt = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => xe(t, e),
		onSuccess: () => r.invalidateQueries({ queryKey: ft(t) })
	});
}, ht = () => n({ mutationFn: we }), gt = (e) => {
	let { template: t, onDeleted: n } = e, { data: r, isLoading: i } = pt(t), o = mt(t), s = ht(), [c, l] = F(""), [u, d] = F(!1);
	return P(() => {
		r && l(r.content);
	}, [r]), /* @__PURE__ */ J(H, {
		gap: "md",
		h: "full",
		p: "lg",
		overflow: "hidden",
		children: [
			/* @__PURE__ */ J(B, {
				justify: "space-between",
				align: "center",
				children: [/* @__PURE__ */ q(U, {
					fontSize: "lg",
					fontWeight: "semibold",
					truncate: !0,
					children: t.title
				}), /* @__PURE__ */ J(B, {
					gap: "sm",
					children: [/* @__PURE__ */ J(L, {
						size: "sm",
						variant: "outline",
						onClick: () => d(!0),
						children: [/* @__PURE__ */ q(a, { size: 14 }), "Delete"]
					}), /* @__PURE__ */ q(L, {
						size: "sm",
						onClick: async () => {
							await o.mutateAsync(c), G.create({
								type: "success",
								title: "Template saved",
								description: t.title
							});
						},
						loading: o.isPending,
						children: "Save"
					})]
				})]
			}),
			i ? /* @__PURE__ */ q(V, { size: "sm" }) : /* @__PURE__ */ q(Me, {
				value: c,
				onChange: (e) => l(e.target.value),
				flex: "1",
				resize: "none",
				fontFamily: "mono",
				fontSize: "sm"
			}),
			/* @__PURE__ */ q(W, {
				open: u,
				onClose: () => d(!1),
				onDelete: async () => {
					await s.mutateAsync(t), n();
				},
				headline: "Delete template",
				notificationText: `This permanently deletes "${t.title}".`,
				buttonText: "Delete template"
			})
		]
	});
}, _t = De(() => import("./skill-viewer-CHuqOXjC.ts").then((e) => ({ default: e.SkillViewer }))), vt = {
	id: "runtime",
	title: "Runtime",
	icon: u.settings
}, Q = {
	runtime: "dashboard.settings.runtime",
	appearance: "dashboard.settings.appearance",
	extensions: "dashboard.settings.extensions",
	projectFolder: "dashboard.settings.project-folder",
	skill: "dashboard.settings.skill",
	template: "dashboard.settings.template",
	machineTokens: "dashboard.settings.machine-tokens",
	dangerZone: "dashboard.settings.danger-zone"
}, yt = (e, t) => {
	let n = e.instance.resource?.metadata?.itemId;
	return typeof n == "string" ? e.workbench.settings.getCollectionItem(t, n) : void 0;
}, bt = {
	kind: "view",
	id: "machine-tokens",
	title: "Machine tokens",
	section: "project",
	scope: "project",
	order: 50,
	icon: "KeyRound",
	viewId: Q.machineTokens
}, xt = (e) => {
	e.settings.registerSection({
		id: "workbench",
		title: "Workbench",
		order: 10,
		scope: "global"
	}), e.settings.registerSection({
		id: "experimental",
		title: "Experimental",
		order: 30,
		scope: "global"
	}), e.views.registerView({
		id: "dashboard.settings.beta-features",
		title: "Beta features",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ q(He, {})
		}
	}), e.settings.registerPanel({
		id: "beta-features",
		title: "Beta features",
		section: "experimental",
		kind: "view",
		scope: "global",
		order: 20,
		icon: "FlaskConical",
		viewId: "dashboard.settings.beta-features"
	}), e.settings.registerSection({
		id: "project",
		title: "Project",
		order: 20,
		scope: "project"
	}), e.views.registerView({
		id: Q.runtime,
		title: "Runtime",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ q(dt, { projectId: S(e) })
		}
	}), e.views.registerView({
		id: Q.appearance,
		title: "Appearance",
		body: {
			kind: "react",
			render: ({ workbench: e }) => /* @__PURE__ */ q(f, { workbench: e })
		}
	}), e.views.registerView({
		id: Q.extensions,
		title: "Extensions",
		body: {
			kind: "react",
			render: (t) => /* @__PURE__ */ q(st, {
				projectId: S(e),
				settingsInput: t
			})
		}
	}), e.views.registerView({
		id: Q.projectFolder,
		title: "Project folder",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ q(lt, { projectId: S(e) })
		}
	}), e.views.registerView({
		id: Q.skill,
		title: "Skill",
		body: {
			kind: "react",
			render: (t) => {
				let n = yt(t, "skills");
				return n ? /* @__PURE__ */ q(Ee, {
					fallback: /* @__PURE__ */ q(V, {}),
					children: /* @__PURE__ */ q(_t, {
						projectId: S(e),
						skillName: n.name
					})
				}) : null;
			}
		}
	}), e.views.registerView({
		id: Q.template,
		title: "Template",
		body: {
			kind: "react",
			render: (t) => {
				let n = yt(t, "templates");
				return n ? /* @__PURE__ */ q(gt, {
					template: n,
					onDeleted: () => {
						e.settings.refresh(), e.commands.executeCommand(p, { panelId: vt.id });
					}
				}, n.id) : null;
			}
		}
	}), e.views.registerView({
		id: Q.machineTokens,
		title: "Machine tokens",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ q(he, { projectId: S(e) })
		}
	}), e.views.registerView({
		id: Q.dangerZone,
		title: "Danger zone",
		body: {
			kind: "react",
			render: (t) => /* @__PURE__ */ q(ct, {
				projectId: S(e),
				projectName: x(e) ?? "Project",
				onDeleted: () => void t.workbench.commands.executeCommand(E.clearSelectedProject)
			})
		}
	}), e.settings.registerPanel({
		kind: "view",
		id: "runtime",
		title: "Runtime",
		section: "workbench",
		scope: "global",
		order: 10,
		icon: "Cpu",
		viewId: Q.runtime
	}), e.settings.registerPanel({
		kind: "view",
		id: "appearance",
		title: "Appearance",
		section: "workbench",
		scope: "global",
		order: 20,
		icon: "Palette",
		viewId: Q.appearance
	}), e.settings.registerPanel({
		kind: "view",
		id: "extensions",
		title: "Extensions",
		section: "project",
		scope: "project",
		order: 10,
		icon: "Puzzle",
		viewId: Q.extensions
	}), e.settings.registerPanel({
		kind: "view",
		id: "project-folder",
		title: "Project folder",
		section: "project",
		scope: "project",
		order: 20,
		icon: "GitBranch",
		viewId: Q.projectFolder
	}), e.settings.registerPanel({
		kind: "collection",
		viewId: Q.skill,
		id: "skills",
		title: "Skills",
		section: "project",
		scope: "project",
		order: 30,
		icon: "Sparkles",
		items: () => {
			let t = S(e);
			return t ? Te(t) : [];
		},
		itemId: (e) => e.name,
		itemLabel: (e) => e.title || e.name
	}), e.settings.registerPanel({
		kind: "collection",
		viewId: Q.template,
		id: "templates",
		title: "Templates",
		section: "project",
		scope: "project",
		when: _,
		order: 40,
		icon: "FileText",
		items: () => {
			let t = S(e);
			return t ? Ce(t) : [];
		},
		itemId: (e) => e.id,
		itemLabel: (e) => e.title || e.name,
		groupBy: {
			key: (e) => e.templateType,
			order: be(S(e) ?? "").map((e) => e.id),
			label: (t) => be(S(e) ?? "").find((e) => e.id === t)?.label ?? t
		}
	}), e.settings.registerPanel({
		kind: "view",
		id: "danger-zone",
		title: "Danger zone",
		section: "project",
		scope: "project",
		order: 2 ** 53 - 1,
		icon: "TriangleAlert",
		viewId: Q.dangerZone
	});
}, $ = () => ({
	id: "dashboard.settings",
	label: "Settings",
	icon: u.settings,
	canHide: !0,
	target: {
		kind: "command",
		commandId: p,
		args: { panelId: vt.id }
	}
}), St = (e) => {
	w(e, {
		id: "dashboard.settings.footer",
		modes: ["project"],
		slot: "footer",
		getStructure: () => [{
			...T.footer,
			nodes: [$()]
		}],
		getSections: () => [{
			...T.footer,
			nodes: [$()]
		}]
	});
}, Ct = () => ({
	id: "dashboard.settings",
	activate(e) {
		xt(e);
		let t = d({ resolveScopeId: (t) => t === "project" ? S(e) : void 0 }).activate(e);
		St(e), e.keybindings.registerKeybinding({
			action: $().target,
			keybinding: "Mod+,"
		}), e.layout.registerMenuItem(c, {
			commandId: p,
			args: $().target.args,
			order: 40
		});
		let n = C(e, () => e.settings.refresh()), r, i = () => {
			let t = b();
			t && !r && (r = e.settings.registerPanel(bt)), !t && r && (r.dispose(), r = void 0);
		}, a = m((e) => {
			e && e.table !== "settings" || i();
		});
		return i(), [
			...Ie(t),
			{ dispose: n },
			{ dispose: a },
			{ dispose: () => r?.dispose() }
		];
	}
});
export { Ke as n, Ve as r, Ct as t };
