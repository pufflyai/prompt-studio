// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useMutation-Dy9eufiq.ts";
import { t as r } from "./useTranslation-DvWg4zeU.ts";
import { n as i } from "./api-D3Fkqs7r.ts";
import { t as a } from "./extension-localization-DzVq3_HP.ts";
import { t as o } from "./use-action-error-DjeAuY1I.ts";
import { useEffect as s, useState as c } from "react";
import { Button as l, HStack as u, Input as d, Stack as f, Text as p } from "@chakra-ui/react";
import { toaster as m } from "@pstdio/ui";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/data/extension-connections-api.ts
var _ = (e) => i().extensions.listConnections(e), v = (e, t, n, r) => i().extensions.configureConnection(e, t, n, r), y = (e, t, n) => i().extensions.checkConnection(e, t, n), b = (e, t, n) => i().extensions.deleteConnection(e, t, n), x = (e) => ["extension-connections", e], S = (e) => t({
	queryKey: x(e),
	queryFn: () => _(e)
}), C = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => v(t, e.extensionId, e.connectionId, {
			baseUrl: e.baseUrl,
			secret: e.secret
		}),
		onSuccess: () => r.invalidateQueries({ queryKey: x(t) })
	});
}, w = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => y(t, e.extensionId, e.connectionId),
		onSuccess: () => r.invalidateQueries({ queryKey: x(t) })
	});
}, T = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => b(t, e.extensionId, e.connectionId),
		onSuccess: () => r.invalidateQueries({ queryKey: x(t) })
	});
}, E = (e) => {
	let { projectId: t, definition: n, configured: i } = e, { showError: _, errorNotice: v, clearError: y } = o(), { t: b } = r("projects"), x = C(t), S = w(t), E = T(t), [D, O] = c(""), [k, A] = c("");
	s(() => {
		O(i?.baseUrl ?? "");
	}, [i?.baseUrl]);
	let j = {
		extensionId: n.extensionId,
		connectionId: n.localId
	}, M = (e) => _({
		title: b("projectSettings.extensionsPanel.connections.actionFailed"),
		description: e.message
	});
	return /* @__PURE__ */ g(f, {
		gap: "sm",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		padding: "md",
		children: [
			v,
			/* @__PURE__ */ g(f, {
				gap: "0",
				children: [/* @__PURE__ */ h(p, {
					textStyle: "label/S/medium",
					children: a(n.label, n.extensionId)
				}), /* @__PURE__ */ g(p, {
					textStyle: "label/XS",
					color: i?.configured ? "fg.success" : "fg.muted",
					children: [i?.configured ? b("projectSettings.extensionsPanel.connections.connected") : b("projectSettings.extensionsPanel.connections.notConnected"), i?.lastCheck ? ` · ${b(i.lastCheck.ok ? "projectSettings.extensionsPanel.connections.lastCheckOk" : "projectSettings.extensionsPanel.connections.lastCheckFailed", { status: i.lastCheck.status ?? "—" })}` : ""]
				})]
			}),
			/* @__PURE__ */ g(f, {
				gap: "2xs",
				children: [/* @__PURE__ */ h(p, {
					textStyle: "label/XS/medium",
					children: b("projectSettings.extensionsPanel.connections.endpoint")
				}), /* @__PURE__ */ h(d, {
					value: D,
					onChange: (e) => O(e.target.value),
					placeholder: "https://"
				})]
			}),
			/* @__PURE__ */ g(f, {
				gap: "2xs",
				children: [/* @__PURE__ */ h(p, {
					textStyle: "label/XS/medium",
					children: b("projectSettings.extensionsPanel.connections.credential")
				}), /* @__PURE__ */ h(d, {
					value: k,
					type: "password",
					onChange: (e) => A(e.target.value),
					placeholder: i?.configured ? b("projectSettings.extensionsPanel.connections.credentialUnchanged") : b("projectSettings.extensionsPanel.connections.credentialRequired")
				})]
			}),
			/* @__PURE__ */ g(u, {
				gap: "xs",
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ h(l, {
						size: "2xs",
						onClick: () => {
							y(), x.mutate({
								...j,
								baseUrl: D,
								secret: k || void 0
							}, {
								onSuccess: () => {
									A(""), m.create({
										type: "success",
										title: b("projectSettings.extensionsPanel.connections.saved")
									});
								},
								onError: M
							});
						},
						disabled: !D || !i?.configured && !k,
						loading: x.isPending,
						children: i?.configured ? b("projectSettings.extensionsPanel.connections.reconnect") : b("projectSettings.extensionsPanel.connections.connect")
					}),
					n.supportsCheck && /* @__PURE__ */ h(l, {
						size: "2xs",
						variant: "outline",
						disabled: !i?.configured,
						loading: S.isPending,
						onClick: () => {
							y(), S.mutate(j, { onError: M });
						},
						children: b("projectSettings.extensionsPanel.connections.check")
					}),
					i?.configured && /* @__PURE__ */ h(l, {
						size: "2xs",
						variant: "destructive",
						loading: E.isPending,
						onClick: () => {
							y(), E.mutate(j, { onError: M });
						},
						children: b("projectSettings.extensionsPanel.connections.revoke")
					})
				]
			})
		]
	});
}, D = (e) => {
	let { projectId: t, definitions: n } = e, { t: i } = r("projects"), a = S(t);
	return /* @__PURE__ */ g(f, {
		gap: "sm",
		children: [/* @__PURE__ */ g(f, {
			gap: "0",
			children: [/* @__PURE__ */ h(p, {
				textStyle: "label/S/medium",
				children: i("projectSettings.extensionsPanel.connections.title")
			}), /* @__PURE__ */ h(p, {
				textStyle: "paragraph/XS/regular",
				color: "fg.muted",
				children: i("projectSettings.extensionsPanel.connections.description")
			})]
		}), n.map((e) => /* @__PURE__ */ h(E, {
			projectId: t,
			definition: e,
			configured: a.data?.connections.find((t) => t.extensionId === e.extensionId && t.connectionId === e.localId)
		}, e.id))]
	});
};
export { D as t };
