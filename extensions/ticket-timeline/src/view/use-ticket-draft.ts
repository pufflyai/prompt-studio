// Own ticket, gate, and artifact drafts; retry the failed step after a node has already been created.
import { useState } from "react";
import type { PlanClient } from "./use-plan";

export type NodeKind = "ticket" | "gate" | "artifact";
export interface CreateContext {
  trackId?: string;
  deadlineId?: string | null;
}

export function useTicketDraft({
  client,
  context,
  kind,
  onDone,
}: {
  client: PlanClient;
  context: CreateContext;
  kind: NodeKind;
  onDone: (id?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [track, setTrack] = useState(context.trackId ?? "");
  const [deadline, setDeadline] = useState(context.deadlineId ?? "none");
  const [dependencies, setDependencies] = useState("");
  const [created, setCreated] = useState<{ id: string; pending: "placement" | "launch" }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      if (created) {
        if (created.pending === "placement") {
          await client.commands["plan.move"]({ ticket: created.id, deadline });
        }
        if (kind === "gate") {
          setCreated({ id: created.id, pending: "launch" });
          await client.commands["gate.launch"]({ ticket: created.id });
        }
        onDone(created.id);
      } else {
        const shared = {
          title,
          track: track || undefined,
          deadline,
          dependsOn: dependencies.split(/[\s,]+/).filter(Boolean),
        };
        const result = await createNode(client, kind, { ...shared, description, url });
        if (result.placementError) {
          setCreated({ id: result.ticket.id, pending: "placement" });
          setError(`Node created. Planning write failed: ${result.placementError}`);
        } else if (result.launchError) {
          setCreated({ id: result.ticket.id, pending: "launch" });
          setError(`Gate created. Agent launch failed: ${result.launchError}`);
        } else {
          onDone(result.ticket.id);
        }
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };
  return {
    title,
    setTitle,
    description,
    setDescription,
    url,
    setUrl,
    track,
    setTrack,
    deadline,
    setDeadline,
    dependencies,
    setDependencies,
    created,
    saving,
    error,
    save,
  };
}

async function createNode(
  client: PlanClient,
  kind: NodeKind,
  input: {
    title: string;
    description: string;
    url: string;
    track?: string;
    deadline: string;
    dependsOn: string[];
  },
) {
  const { description, url, ...shared } = input;
  if (kind === "gate") {
    return client.commands["gate.create"]({ ...shared, instructions: description });
  }
  const result =
    kind === "artifact"
      ? await client.commands["artifact.create"]({ ...shared, description, url })
      : await client.commands["ticket.create"]({ ...shared, description });
  return { ...result, launchError: null };
}
