import type { GuestHost } from "@pstdio/sdk/extensions";
import {
  type AttributeDescriptor,
  KanbanRendererCreateDialog,
  type KanbanRendererCreateSubmission,
} from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { buildTicketAttributes } from "../../data/mappers";
import { createTicketFormConfig, localizeTicketFormValue } from "../../ticket-create-form";
import type { Plan } from "../contracts";
import { timelineTicketProperties } from "../model/ticket-properties";
import type { PlanClient } from "./use-plan";

export interface CreateContext {
  trackId?: string;
  deadlineId?: string | null;
}
interface TicketFormProps {
  client: PlanClient;
  host: GuestHost;
  plan: Plan;
  context: CreateContext;
  kind: "ticket" | "gate";
  onDone: (id?: string) => void;
  t: (key: string, fallback?: string) => string;
}

export function TicketForm(props: TicketFormProps) {
  const { client, host, plan, context, kind, onDone, t } = props;
  const [created, setCreated] = useState<{ id: string; pending: "placement" | "launch" }>();
  const shared = createTicketFormConfig(t);
  const milestoneOptions = [
    { value: "none", label: "Unscheduled", icon: "calendar-off" },
    ...plan.sections.flatMap(({ deadline }) =>
      deadline ? [{ value: deadline.id, label: deadline.name ?? deadline.date, icon: "calendar" }] : [],
    ),
  ];
  const attributes: AttributeDescriptor[] = [
    ...buildTicketAttributes(plan.statuses, plan.tags),
    ...timelineTicketProperties(plan).attributes,
  ].flatMap((attribute) => {
    const type = attribute.type;
    if (!attribute.editable || attribute.id === "milestone" || (type.kind !== "enum" && type.kind !== "enum-multi"))
      return [];
    return [
      {
        ...attribute,
        label: localizeTicketFormValue(attribute.label, t),
        type: {
          ...type,
          options: Array.isArray(type.options)
            ? type.options.map((option) => ({ ...option, label: localizeTicketFormValue(option.label, t) }))
            : [],
        },
      },
    ];
  });
  const config = {
    ...shared,
    title: kind === "gate" ? "New agent gate" : shared.title,
    submitLabel: kind === "gate" ? "Create and review gate" : shared.submitLabel,
    fields: [
      ...shared.fields,
      {
        id: "deadline",
        label: "Milestone",
        type: "select" as const,
        defaultValue: context.deadlineId ?? "none",
        options: milestoneOptions,
      },
      {
        id: "dependsOn",
        label: "Prerequisites",
        type: "text" as const,
        placeholder: "Ticket IDs, separated by commas",
      },
    ],
  };
  if (created) {
    config.title =
      created.pending === "placement" ? "Ticket created. Retry placement." : "Gate created. Retry review launch.";
    config.submitLabel = created.pending === "placement" ? "Retry placement" : "Launch review";
  }
  const submit = async (submission: KanbanRendererCreateSubmission) => {
    const deadline = String(submission.values.deadline ?? (submission.attributeValues.milestone || "none"));
    if (created) {
      if (created.pending === "placement")
        await client.commands["timeline.plan.move"]({ ticket: created.id, deadline });
      if (kind === "gate") {
        setCreated({ id: created.id, pending: "launch" });
        await client.commands["timeline.gate.launch"]({ ticket: created.id });
      }
      onDone(created.id);
      return;
    }
    const attachments = await Promise.all(
      submission.files.map(async (file) =>
        host
          .call("files.upload", {
            name: file.name,
            data: await file.arrayBuffer(),
            mimeType: file.type,
            scope: { type: "project" },
          })
          .then((ref) => ({ ...ref, hash: ref.hash ?? "" })),
      ),
    );
    const input = {
      content: String(submission.values.content ?? ""),
      attributes: {
        ...submission.attributeValues,
        status: submission.attributeValues.status || defaultStatusId,
      },
      attachments,
      deadline,
      dependsOn: String(submission.values.dependsOn ?? "")
        .split(/[\s,]+/)
        .filter(Boolean),
    };
    const result =
      kind === "gate"
        ? await client.commands["timeline.gate.create"](input)
        : { ...(await client.commands["timeline.ticket.create"](input)), launchError: null };
    if (result.placementError) {
      setCreated({ id: result.ticket.id, pending: "placement" });
      throw new Error(`Ticket created. Could not save its milestone: ${result.placementError}`);
    }
    if (result.launchError) {
      setCreated({ id: result.ticket.id, pending: "launch" });
      throw new Error(`Gate created. Could not launch its review: ${result.launchError}`);
    }
    onDone(result.ticket.id);
  };
  const columnAttributeId = context.trackId ? plan.trackProperty?.id : "status";
  const defaultStatusId = plan.statuses.find((status) => status.isDefault)?.id ?? "";
  return (
    <KanbanRendererCreateDialog
      open
      columnId={context.trackId ?? defaultStatusId}
      columnAttributeId={columnAttributeId}
      attributes={created ? [] : attributes}
      config={
        created
          ? {
              ...config,
              fields: [
                {
                  id: "deadline",
                  label: "Milestone",
                  type: "select",
                  defaultValue: context.deadlineId ?? "none",
                  options: milestoneOptions,
                },
              ],
            }
          : config
      }
      onClose={() => onDone()}
      onSubmit={submit}
    />
  );
}
