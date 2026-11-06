import { Button, Stack, Text } from "@chakra-ui/react";
import type { WebviewHostProps } from "@pstdio/sdk/extensions";
import { AlertMessage, DeleteConfirmationModal, Palette, ScrollArea } from "@pstdio/ui";
import { AuthoringForm } from "./authoring-form";
import { BookBrowser } from "./book-browser";
import { BookControls } from "./book-controls";
import { SourceContext } from "./book-resource-tag";
import { BookSource } from "./book-source";
import type { BookClient } from "./client";
import { ReviewList } from "./review-list";
import { useAuthoring } from "./use-authoring";

interface Props {
  client: BookClient;
  hostProps: WebviewHostProps;
}
export function BookApp(props: Props) {
  const { client, hostProps } = props;
  const state = useAuthoring(client, hostProps);
  const { data, section } = state;
  if (!data)
    return (
      <Stack p="lg">
        {state.error ? (
          <AlertMessage status="error" title="Could not load the book">
            {state.error}
            <Button onClick={state.refresh}>Retry</Button>
          </AlertMessage>
        ) : (
          <Text>Loading requirement book…</Text>
        )}
      </Stack>
    );
  const heading = section ?? data.chapters.find((chapter) => chapter.id === state.chapter)?.title ?? "Requirement book";
  return (
    <SourceContext value={state.openSource}>
      <Stack h="100dvh" minH="0" minW="0" gap="0" bg="bg" color="fg">
        <BookControls
          data={data}
          revision={state.revision}
          heading={heading}
          section={section}
          client={client}
          run={state.run}
          onRevision={(revision) => {
            state.setRevision(revision);
            state.setEditor(null);
          }}
          onSearch={() => state.setSearch(true)}
        />
        {state.error && (
          <AlertMessage status="error" title="Could not update the book" onClose={() => state.setError("")}>
            {state.error}
          </AlertMessage>
        )}
        {!data.exists ? (
          <Stack p="lg" gap="md">
            <Text>No canonical book exists in this revision.</Text>
            <Text color="fg.muted">
              Choose a working workspace containing the migrated book. Accepted intent appears when that repository
              migration reaches the target branch.
            </Text>
          </Stack>
        ) : null}
        {data.exists && section ? (
          <ScrollArea flex="1" minH="0">
            <Stack p="lg">
              <ReviewList
                data={data}
                section={section}
                focusedId={state.focusedId}
                client={client}
                run={state.run}
                onOpen={state.open}
                onMap={state.map}
                onPromote={(id) => {
                  state.setPromoteId(id);
                  state.setForm("rule");
                }}
              />
            </Stack>
          </ScrollArea>
        ) : null}
        {data.exists && !section ? (
          <BookBrowser
            rules={data.rules}
            chapters={data.chapters}
            onMove={state.move}
            chapter={state.chapter}
            selected={state.selected}
            editor={state.editor}
            observations={data.observations}
            onMapObservation={state.map}
            onSelect={(ref) => {
              state.setSelected(ref);
              state.setEditor(null);
            }}
            onOpen={state.open}
            onEdit={state.edit}
            onRemove={state.setRemoving}
            onSave={state.save}
            onCancel={() => state.setEditor(null)}
          />
        ) : null}
        <Palette
          open={state.search}
          label="Search requirements"
          placeholder="Find an RB reference, title, or statement…"
          onClose={() => state.setSearch(false)}
          entries={data.rules.map((rule) => ({
            id: rule.ref,
            label: rule.title,
            secondaryLabel: rule.ref,
            searchText: `${rule.statement} ${rule.scope}`,
            onActivate: () => {
              state.setSearch(false);
              state.open(rule.ref);
            },
          }))}
        />
        {state.form && (
          <AuthoringForm
            key={`${state.form}-${state.chapter}`}
            mode={state.form}
            chapter={state.chapter}
            data={data}
            client={client}
            promoteId={state.promoteId}
            onClose={() => {
              state.setForm(null);
              state.setPromoteId(undefined);
              state.refresh();
            }}
            onSaved={state.formSaved}
            onDraftSaved={state.cacheDraft}
          />
        )}
        {state.source && <BookSource source={state.source} onClose={() => state.setSource(null)} />}
        <DeleteConfirmationModal
          open={Boolean(state.removing)}
          onClose={() => state.setRemoving(null)}
          headline={`Propose removing ${state.removing?.ref ?? "rule"}?`}
          notificationText="Inspect the rule removal and incoming reference changes in Suggestions before applying them to the working branch."
          buttonText="Create removal suggestion"
          onDelete={state.remove}
        />
      </Stack>
    </SourceContext>
  );
}
