// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useMutation-Dy9eufiq.ts";
import { t as r } from "./useTranslation-DvWg4zeU.ts";
import { n as i } from "./api-D3Fkqs7r.ts";
import { t as a } from "./use-action-error-DjeAuY1I.ts";
import { useState as o } from "react";
import { Box as s, Button as c, HStack as l, Input as u, Spinner as d, Stack as f, Text as p, Textarea as m } from "@chakra-ui/react";
import { Fragment as h, jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/data/automation-tokens-api.ts
var v = (e) => i().automation.listTokens(e), y = (e) => i().automation.issueToken(e), b = (e) => i().automation.revokeToken(e), x = (e) => ["automation-tokens", e], S = (e) => t({
	queryKey: x(e),
	queryFn: () => v(e),
	enabled: !!e
}), C = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => y({
			...e,
			projectId: t
		}),
		onSuccess: () => r.invalidateQueries({ queryKey: x(t) })
	});
}, w = (t) => {
	let r = e();
	return n({
		mutationFn: b,
		onSuccess: () => r.invalidateQueries({ queryKey: x(t) })
	});
}, T = (e) => {
	let { tokens: t, issuedToken: n, name: i, scopes: a, expiresInDays: o, loading: h, issuing: v, revokingTokenId: y, onNameChange: b, onScopesChange: x, onExpiresInDaysChange: S, onIssue: C, onRevoke: w, onCopy: T } = e, { t: E } = r("projects"), D = Number.isInteger(Number(o)) && Number(o) > 0, O = !!(i.trim() && a.trim() && D);
	return /* @__PURE__ */ _(f, {
		gap: "md",
		padding: "lg",
		maxW: "720px",
		children: [
			/* @__PURE__ */ _(f, {
				gap: "2xs",
				children: [/* @__PURE__ */ g(p, {
					textStyle: "heading/S",
					children: E("projectSettings.machineTokens.title")
				}), /* @__PURE__ */ g(p, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: E("projectSettings.machineTokens.description")
				})]
			}),
			n && /* @__PURE__ */ _(f, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.success",
				borderRadius: "md",
				padding: "md",
				children: [/* @__PURE__ */ _(f, {
					gap: "0",
					children: [/* @__PURE__ */ g(p, {
						textStyle: "label/S/medium",
						children: E("projectSettings.machineTokens.issuedTitle")
					}), /* @__PURE__ */ g(p, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: E("projectSettings.machineTokens.issuedDescription")
					})]
				}), /* @__PURE__ */ _(l, {
					gap: "xs",
					children: [/* @__PURE__ */ g(u, {
						value: n,
						readOnly: !0,
						fontFamily: "mono"
					}), /* @__PURE__ */ g(c, {
						size: "sm",
						variant: "outline",
						onClick: T,
						children: E("projectSettings.machineTokens.copy")
					})]
				})]
			}),
			/* @__PURE__ */ _(f, {
				gap: "sm",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "md",
				padding: "md",
				children: [
					/* @__PURE__ */ g(p, {
						textStyle: "label/S/medium",
						children: E("projectSettings.machineTokens.issueTitle")
					}),
					/* @__PURE__ */ _(f, {
						gap: "2xs",
						children: [/* @__PURE__ */ g(p, {
							textStyle: "label/XS/medium",
							children: E("projectSettings.machineTokens.name")
						}), /* @__PURE__ */ g(u, {
							value: i,
							onChange: (e) => b(e.target.value)
						})]
					}),
					/* @__PURE__ */ _(f, {
						gap: "2xs",
						children: [
							/* @__PURE__ */ g(p, {
								textStyle: "label/XS/medium",
								children: E("projectSettings.machineTokens.scopes")
							}),
							/* @__PURE__ */ g(m, {
								value: a,
								onChange: (e) => x(e.target.value),
								minH: "24"
							}),
							/* @__PURE__ */ g(p, {
								textStyle: "paragraph/XS/regular",
								color: "fg.muted",
								children: E("projectSettings.machineTokens.scopesHint")
							})
						]
					}),
					/* @__PURE__ */ _(f, {
						gap: "2xs",
						children: [/* @__PURE__ */ g(p, {
							textStyle: "label/XS/medium",
							children: E("projectSettings.machineTokens.expiry")
						}), /* @__PURE__ */ g(u, {
							value: o,
							type: "number",
							min: 1,
							max: 365,
							onChange: (e) => S(e.target.value)
						})]
					}),
					/* @__PURE__ */ g(c, {
						size: "sm",
						alignSelf: "start",
						disabled: !O,
						loading: v,
						onClick: C,
						children: E("projectSettings.machineTokens.issue")
					})
				]
			}),
			/* @__PURE__ */ _(f, {
				gap: "sm",
				children: [
					/* @__PURE__ */ g(p, {
						textStyle: "label/S/medium",
						children: E("projectSettings.machineTokens.activeTitle")
					}),
					h ? /* @__PURE__ */ g(s, {
						py: "md",
						display: "flex",
						justifyContent: "center",
						children: /* @__PURE__ */ g(d, { size: "sm" })
					}) : null,
					!h && t.length === 0 ? /* @__PURE__ */ g(p, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: E("projectSettings.machineTokens.empty")
					}) : null,
					!h && t.map((e) => /* @__PURE__ */ _(l, {
						gap: "md",
						borderWidth: "1px",
						borderColor: "border.subtle",
						borderRadius: "md",
						padding: "md",
						children: [/* @__PURE__ */ _(f, {
							gap: "0",
							flex: "1",
							minW: "0",
							children: [
								/* @__PURE__ */ g(p, {
									textStyle: "label/S/medium",
									children: e.name
								}),
								/* @__PURE__ */ _(p, {
									textStyle: "label/XS",
									color: "fg.muted",
									fontFamily: "mono",
									truncate: !0,
									children: [
										e.tokenPrefix,
										" · ",
										e.commandScopes.join(", ")
									]
								}),
								/* @__PURE__ */ g(p, {
									textStyle: "label/XS",
									color: "fg.subtle",
									children: E("projectSettings.machineTokens.expires", { date: new Date(e.expiresAt).toLocaleString() })
								})
							]
						}), /* @__PURE__ */ g(c, {
							size: "2xs",
							variant: "destructive",
							loading: y === e.id,
							onClick: () => w(e.id),
							children: E("projectSettings.machineTokens.revoke")
						})]
					}, e.id))
				]
			})
		]
	});
}, E = (e) => {
	let { projectId: t } = e, { showError: n, errorNotice: i, clearError: s } = a(), { t: c } = r("projects"), l = S(t ?? ""), u = C(t ?? ""), d = w(t ?? ""), [f, p] = o(""), [m, v] = o(""), [y, b] = o("30"), [x, E] = o(null);
	return t ? /* @__PURE__ */ _(h, { children: [i, /* @__PURE__ */ g(T, {
		tokens: l.data?.tokens.filter((e) => !e.revokedAt) ?? [],
		issuedToken: x,
		name: f,
		scopes: m,
		expiresInDays: y,
		loading: l.isLoading,
		issuing: u.isPending,
		revokingTokenId: d.isPending ? d.variables : void 0,
		onNameChange: p,
		onScopesChange: v,
		onExpiresInDaysChange: b,
		onIssue: () => {
			s(), u.mutate({
				name: f,
				commandScopes: m.split(/\r?\n/).map((e) => e.trim()).filter(Boolean),
				expiresInSeconds: Number(y) * 24 * 60 * 60
			}, {
				onSuccess: (e) => {
					E(e.token), p(""), v("");
				},
				onError: (e) => n({
					title: c("projectSettings.machineTokens.issueFailed"),
					description: e.message
				})
			});
		},
		onRevoke: (e) => {
			s(), d.mutate(e, { onError: (e) => n({ title: e.message }) });
		},
		onCopy: () => {
			x && navigator.clipboard.writeText(x);
		}
	})] }) : null;
};
export { T as n, E as t };
