// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./mappers-07bJ6k9J.ts";
import { n as t, t as n } from "./ticket-create-form-CcZ40XLh.ts";
import { n as r, r as i } from "./review-request-summary-Dm_YOaPy.ts";
import { useState as a } from "react";
import { Button as o, Dialog as s, Flex as c, Input as l, Portal as u, Stack as d, Text as f, chakra as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
import { l10n as g } from "@pstdio/sdk/extensions";
import { KanbanRendererCreateDialog as _ } from "@pstdio/ui/kanban-renderer";
// extensions/pstdio-planner/src/timeline/view/deadline-form.tsx
function v(e) {
	let { client: t, initialDate: n, onDone: r } = e, [i, s] = a(n ?? ""), [u, g] = a(""), [_, v] = a(!1), [y, b] = a();
	return /* @__PURE__ */ h(d, {
		gap: "xs",
		p: "sm",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		bg: "bg.subtle",
		children: [/* @__PURE__ */ h(c, {
			gap: "sm",
			align: "end",
			wrap: "wrap",
			children: [
				/* @__PURE__ */ h(d, {
					gap: "xs",
					children: [/* @__PURE__ */ m(p.label, {
						htmlFor: "deadline-date",
						textStyle: "label/S/regular",
						color: "fg.muted",
						children: "Date"
					}), /* @__PURE__ */ m(l, {
						id: "deadline-date",
						type: "date",
						size: "sm",
						w: "160px",
						value: i,
						onChange: (e) => s(e.target.value)
					})]
				}),
				/* @__PURE__ */ h(d, {
					gap: "xs",
					flex: "1",
					minW: "200px",
					children: [/* @__PURE__ */ m(p.label, {
						htmlFor: "deadline-name",
						textStyle: "label/S/regular",
						color: "fg.muted",
						children: "Name (optional)"
					}), /* @__PURE__ */ m(l, {
						id: "deadline-name",
						size: "sm",
						placeholder: "Staging acceptance",
						value: u,
						onChange: (e) => g(e.target.value)
					})]
				}),
				/* @__PURE__ */ m(o, {
					size: "sm",
					onClick: async () => {
						v(!0), b(void 0);
						try {
							await t.commands["timeline.deadline.create"]({
								date: i,
								...u.trim() ? { name: u } : {}
							}), r();
						} catch (e) {
							b(String(e));
						} finally {
							v(!1);
						}
					},
					disabled: !i || _,
					loading: _,
					children: "Add milestone"
				}),
				/* @__PURE__ */ m(o, {
					size: "sm",
					variant: "ghost",
					onClick: r,
					children: "Cancel"
				})
			]
		}), y ? /* @__PURE__ */ m(f, {
			role: "alert",
			color: "fg.error",
			textStyle: "label/S/regular",
			children: y
		}) : null]
	});
}
// extensions/pstdio-planner/src/timeline/model/ticket-properties.ts
function y(e) {
	return [
		{
			id: "milestone",
			label: g("ticketProperties.milestone", "Milestone"),
			type: {
				kind: "enum",
				options: e.map((e) => ({
					value: e.id,
					label: e.name || e.date,
					icon: "calendar"
				}))
			},
			filterable: !0,
			displayable: !0,
			groupable: !0
		},
		{
			id: "milestoneDate",
			label: g("ticketProperties.milestoneDate", "Milestone date"),
			type: { kind: "date" },
			filterable: !0,
			displayable: !0,
			sortable: !0
		},
		{
			id: "milestoneState",
			label: g("ticketProperties.milestoneProgress", "Milestone progress"),
			type: {
				kind: "enum",
				options: [
					{
						value: "unscheduled",
						label: g("ticketProperties.unscheduled", "Unscheduled")
					},
					{
						value: "open",
						label: g("ticketProperties.milestoneOpen", "Open")
					},
					{
						value: "complete",
						label: g("ticketProperties.milestoneComplete", "Complete")
					},
					{
						value: "completed-past",
						label: g("ticketProperties.milestoneCompletedPast", "Completed past milestone")
					}
				]
			},
			filterable: !0,
			displayable: !0
		},
		{
			id: "needsAttention",
			label: g("ticketProperties.needsAttention", "Needs attention"),
			type: {
				kind: "enum",
				options: [{
					value: "yes",
					label: g("ticketProperties.yes", "Yes")
				}, {
					value: "no",
					label: g("ticketProperties.no", "No")
				}]
			},
			filterable: !0,
			displayable: !0,
			display: {
				kind: "badge-list",
				itemsAttributeId: r
			}
		},
		{
			id: "reviewRequests",
			label: g("ticketProperties.reviewRequests", "Review requests"),
			type: {
				kind: "enum",
				options: [{
					value: "requested",
					label: g("ticketProperties.reviewRequested", "Review requested"),
					icon: "user-round",
					color: "orange"
				}, {
					value: "answered",
					label: g("ticketProperties.reviewAnswered", "Review answered"),
					icon: "user-check",
					color: "green"
				}]
			},
			filterable: !0,
			displayable: !1
		}
	];
}
function b(e) {
	return {
		attributes: y(e.sections.flatMap(({ deadline: e }) => e ? [e] : [])),
		values: new Map(e.sections.flatMap((e) => {
			let { deadline: t, counts: n } = e, a = "unscheduled";
			return t && (a = "open", n.total > 0 && n.done === n.total && (a = t.daysLeft < 0 ? "completed-past" : "complete")), e.rows.map((e) => [e.id, {
				milestone: t?.id ?? "",
				milestoneDate: t?.date ?? null,
				milestoneState: a,
				needsAttention: !e.done && (e.flags.length > 0 || e.blocks.length > 0) ? "yes" : "no",
				reviewRequests: e.requestErrors.length > 0 || e.requests.some(({ state: e }) => e === "open") ? "requested" : x(e),
				[r]: i({
					requests: e.requests,
					errors: e.requestErrors
				}, e.target.resource)
			}]);
		}))
	};
}
function x(e) {
	return e.requests.some(({ state: e }) => e === "answered") ? "answered" : "";
}
// extensions/pstdio-planner/src/timeline/view/ticket-form.tsx
function S(r) {
	let { client: i, host: o, plan: s, context: c, kind: l, onDone: u, t: d } = r, [f, p] = a(), h = n(d), g = [{
		value: "none",
		label: "Unscheduled",
		icon: "calendar-off"
	}, ...s.sections.flatMap(({ deadline: e }) => e ? [{
		value: e.id,
		label: e.name ?? e.date,
		icon: "calendar"
	}] : [])], v = [...e(s.statuses, s.tags), ...b(s).attributes].flatMap((e) => {
		let n = e.type;
		return !e.editable || e.id === "milestone" || n.kind !== "enum" && n.kind !== "enum-multi" ? [] : [{
			...e,
			label: t(e.label, d),
			type: {
				...n,
				options: Array.isArray(n.options) ? n.options.map((e) => ({
					...e,
					label: t(e.label, d)
				})) : []
			}
		}];
	}), y = {
		...h,
		title: l === "gate" ? "New agent gate" : h.title,
		submitLabel: l === "gate" ? "Create and review gate" : h.submitLabel,
		fields: [...h.fields, {
			id: "deadline",
			label: "Milestone",
			type: "select",
			defaultValue: c.deadlineId ?? "none",
			options: g
		}]
	};
	f && (y.title = f.pending === "placement" ? "Ticket created. Retry placement." : "Gate created. Retry review launch.", y.submitLabel = f.pending === "placement" ? "Retry placement" : "Launch review");
	let x = async (e) => {
		let t = String(e.values.deadline ?? (e.attributeValues.milestone || "none"));
		if (f) {
			f.pending === "placement" && await i.commands["timeline.plan.move"]({
				ticket: f.id,
				deadline: t
			}), l === "gate" && (p({
				id: f.id,
				pending: "launch"
			}), await i.commands["timeline.gate.launch"]({ ticket: f.id })), u(f.id);
			return;
		}
		let n = await Promise.all(e.files.map(async (e) => o.call("files.upload", {
			name: e.name,
			data: await e.arrayBuffer(),
			mimeType: e.type,
			scope: { type: "project" }
		}).then((e) => ({
			...e,
			hash: e.hash ?? ""
		})))), r = {
			content: String(e.values.content ?? ""),
			attributes: {
				...e.attributeValues,
				status: e.attributeValues.status || C
			},
			attachments: n,
			deadline: t
		}, a = l === "gate" ? await i.commands["timeline.gate.create"](r) : {
			...await i.commands["timeline.ticket.create"](r),
			launchError: null
		};
		if (a.placementError) throw p({
			id: a.ticket.id,
			pending: "placement"
		}), Error(`Ticket created. Could not save its milestone: ${a.placementError}`);
		if (a.launchError) throw p({
			id: a.ticket.id,
			pending: "launch"
		}), Error(`Gate created. Could not launch its review: ${a.launchError}`);
		u(a.ticket.id);
	}, S = c.trackId ? s.trackProperty?.id : "status", C = s.statuses.find((e) => e.isDefault)?.id ?? "";
	return /* @__PURE__ */ m(_, {
		open: !0,
		columnId: c.trackId ?? C,
		columnAttributeId: S,
		attributes: f ? [] : v,
		config: f ? {
			...y,
			fields: [{
				id: "deadline",
				label: "Milestone",
				type: "select",
				defaultValue: c.deadlineId ?? "none",
				options: g
			}]
		} : y,
		onClose: () => u(),
		onSubmit: x
	});
}
// extensions/pstdio-planner/src/timeline/view/track-form.tsx
function C(e) {
	let { client: t, onDone: n } = e, [r, i] = a(""), [s, c] = a(!1), [u, g] = a(), _ = async () => {
		c(!0), g(void 0);
		try {
			await t.commands["timeline.track.create"]({ name: r }), n();
		} catch (e) {
			g(String(e));
		} finally {
			c(!1);
		}
	};
	return /* @__PURE__ */ m(p.form, {
		onSubmit: (e) => {
			e.preventDefault(), _();
		},
		children: /* @__PURE__ */ h(d, {
			gap: "sm",
			children: [
				/* @__PURE__ */ m(p.label, {
					htmlFor: "track-name",
					children: "Feature track name"
				}),
				/* @__PURE__ */ m(l, {
					autoFocus: !0,
					id: "track-name",
					value: r,
					onChange: (e) => i(e.target.value),
					placeholder: "Catalogue auditing"
				}),
				u ? /* @__PURE__ */ m(f, {
					role: "alert",
					color: "fg.error",
					children: u
				}) : null,
				/* @__PURE__ */ m(o, {
					type: "submit",
					disabled: !r.trim() || s,
					loading: s,
					children: "Create track"
				})
			]
		})
	});
}
// extensions/pstdio-planner/src/timeline/view/plan-editor.tsx
function w(e) {
	let { editor: t, host: n, t: r, client: i, plan: a, onDone: o } = e, c = "New milestone";
	return t.kind === "track" && (c = "New feature track"), t.kind === "ticket" && (c = "New ticket"), t.kind === "gate" && (c = "New agent gate"), t.kind === "ticket" || t.kind === "gate" ? /* @__PURE__ */ m(S, {
		host: n,
		t: r,
		client: i,
		plan: a,
		context: t.context,
		kind: t.kind,
		onDone: o
	}) : /* @__PURE__ */ m(s.Root, {
		open: !0,
		onOpenChange: ({ open: e }) => {
			e || o();
		},
		size: "md",
		children: /* @__PURE__ */ h(u, { children: [/* @__PURE__ */ m(s.Backdrop, {}), /* @__PURE__ */ m(s.Positioner, { children: /* @__PURE__ */ h(s.Content, { children: [
			/* @__PURE__ */ m(s.Header, { children: /* @__PURE__ */ m(s.Title, { children: c }) }),
			/* @__PURE__ */ h(s.Body, {
				pb: "md",
				children: [t.kind === "track" ? /* @__PURE__ */ m(C, {
					client: i,
					onDone: o
				}) : null, t.kind === "deadline" ? /* @__PURE__ */ m(v, {
					client: i,
					initialDate: t.date,
					onDone: o
				}) : null]
			}),
			/* @__PURE__ */ m(s.CloseTrigger, {})
		] }) })] })
	});
}
export { w as PlanEditor };
