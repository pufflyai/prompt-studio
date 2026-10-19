import { createWebviewClient, type GuestHost, type WebviewCommandsExecuteParams } from "@pstdio/sdk/extensions";
import type { ComponentProps } from "react";
import { useState } from "react";
import { GraphCard } from "./graph-card";
import type { PlanClient } from "./use-plan";

export function EditableCardPreview(props: ComponentProps<typeof GraphCard>) {
  const [values, setValues] = useState<Record<string, unknown>>({ status: props.row.status?.id, type: "feature" });
  const [host] = useState<GuestHost>(() => ({
    call: (async (method, request) => {
      if (method === "resources.actions") return [{ key: "run", label: "Run attempt", icon: "Play" }];
      if (method === "commands.execute") {
        const { params } = request as WebviewCommandsExecuteParams;
        setValues((current) => ({ ...current, [String(params?.attributeId)]: params?.value }));
        return { outcome: { ok: true, status: "success", value: null } };
      }
    }) as GuestHost["call"],
    onEvent: () => () => {},
  }));
  const source = {
    id: props.row.id,
    title: props.row.title,
    attributes: values,
    resource: { type: "ticket", id: props.row.id },
  };
  return (
    <GraphCard
      {...props}
      interaction={{
        host,
        client: createWebviewClient(host) as PlanClient,
        rows: new Map([[source.id, source]]),
        attributes: [
          {
            id: "status",
            label: "Status",
            editable: true,
            displayable: true,
            type: {
              kind: "enum",
              options: [
                { value: props.row.status?.id ?? "todo", label: props.row.status?.name ?? "Todo" },
                { value: "done", label: "Done" },
              ],
            },
          },
          {
            id: "type",
            label: "Type",
            editable: true,
            displayable: true,
            type: {
              kind: "enum",
              options: [
                { value: "feature", label: "Feature" },
                { value: "bug", label: "Bug" },
              ],
            },
          },
        ],
      }}
    />
  );
}
