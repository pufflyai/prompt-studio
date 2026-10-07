// Create a ticket, free-form agent review, or linked prototype using the same placement controls.
import { Button, chakra, Input, NativeSelect, Stack, Text, Textarea } from "@chakra-ui/react";
import type { Plan } from "../contracts";
import { ArtifactPicker } from "./artifact-picker";
import type { PlanClient } from "./use-plan";
import { type CreateContext, type NodeKind, useTicketDraft } from "./use-ticket-draft";

export type { CreateContext } from "./use-ticket-draft";

interface Props {
  client: PlanClient;
  plan: Plan;
  context: CreateContext;
  kind: NodeKind;
  onDone: (id?: string) => void;
}

const labels = { ticket: "Create ticket", gate: "Create and review gate", artifact: "Create artifact node" };

export function TicketForm({ client, plan, context, kind, onDone }: Props) {
  const draft = useTicketDraft({ client, context, kind, onDone });
  const { title, description, url, track, deadline, dependencies, created, saving, error } = draft;
  const complete = title.trim() && (kind !== "gate" || description.trim()) && (kind !== "artifact" || url);
  let submitLabel = labels[kind];
  if (created) {
    submitLabel = created.pending === "launch" ? "Launch review" : "Retry placement";
  }
  return (
    <chakra.form
      onSubmit={(event) => {
        event.preventDefault();
        void draft.save();
      }}
    >
      <Stack gap="sm">
        <chakra.label htmlFor="new-ticket-title">Title</chakra.label>
        <Input
          autoFocus
          id="new-ticket-title"
          value={title}
          disabled={!!created}
          onChange={(event) => draft.setTitle(event.target.value)}
        />
        <chakra.label htmlFor="new-ticket-description">{kind === "gate" ? "Instructions" : "Description"}</chakra.label>
        <Textarea
          id="new-ticket-description"
          value={description}
          disabled={!!created}
          onChange={(event) => draft.setDescription(event.target.value)}
          placeholder={
            kind === "gate"
              ? "Review the prototype and dependencies. Update the plan to reach a usable rehearsal."
              : undefined
          }
        />
        {kind === "gate" ? (
          <Text textStyle="label/S/regular" color="fg.muted">
            Creating this gate launches an agent to review the project and update the plan.
          </Text>
        ) : null}
        {kind === "artifact" ? (
          <ArtifactPicker client={client} value={url} onChange={draft.setUrl} disabled={!!created} />
        ) : null}
        <chakra.label htmlFor="new-ticket-track">Track</chakra.label>
        <NativeSelect.Root disabled={!!created}>
          <NativeSelect.Field
            id="new-ticket-track"
            value={track}
            onChange={(event) => draft.setTrack(event.target.value)}
          >
            <option value="">Unassigned</option>
            {plan.trackProperty?.options.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <chakra.label htmlFor="new-ticket-deadline">Milestone</chakra.label>
        <NativeSelect.Root disabled={created?.pending === "launch"}>
          <NativeSelect.Field
            id="new-ticket-deadline"
            value={deadline}
            onChange={(event) => draft.setDeadline(event.target.value)}
          >
            <option value="none">Unscheduled</option>
            {plan.sections.flatMap(({ deadline: entry }) =>
              entry
                ? [
                    <option key={entry.id} value={entry.id}>
                      {entry.name ?? entry.date} · {entry.date}
                    </option>,
                  ]
                : [],
            )}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <chakra.label htmlFor="new-ticket-dependencies">Prerequisites (ticket IDs, separated by commas)</chakra.label>
        <Input
          id="new-ticket-dependencies"
          value={dependencies}
          disabled={!!created}
          onChange={(event) => draft.setDependencies(event.target.value)}
          placeholder="K-25, K-81"
        />
        {error ? (
          <Text role="alert" color="fg.error">
            {error}
          </Text>
        ) : null}
        <Button type="submit" disabled={!complete || saving} loading={saving}>
          {submitLabel}
        </Button>
      </Stack>
    </chakra.form>
  );
}
