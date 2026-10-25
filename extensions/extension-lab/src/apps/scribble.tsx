import { IconButton } from "@chakra-ui/react";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { EmptyState } from "@pstdio/ui";
import { useState } from "react";
import { useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import type { scribbleCommands } from "../scribble-commands";
import { documentMarkdown } from "../state-defaults";
import type { ExampleViewInput } from "../view-context";
import { ScribbleDraftCanvas } from "./scribble-draft";
import { ScribbleEditor } from "./scribble-editor";
import { scribbleStore } from "./scribble-store";

export const DocumentCanvas = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  if (input.resource?.type === "scribble.draft") return <ScribbleDraftCanvas key={input.resource.id} input={input} />;
  return <SavedDocumentCanvas key={input.resource?.id} input={input} />;
};

const SavedDocumentCanvas = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(scribbleStore);
  const [error, setError] = useState<string>();
  const doc = state.documents.find((item) => item.id === input.resource?.id);
  if (!doc) return <EmptyState title="Page not found" />;
  const favorite = state.favoriteIds.includes(doc.id);
  const toggleFavorite = () =>
    scribbleStore.setState((current) => ({
      ...current,
      favoriteIds: favorite ? current.favoriteIds.filter((id) => id !== doc.id) : [...current.favoriteIds, doc.id],
    }));
  const markdown = state.contentById[doc.id] ?? documentMarkdown(doc);
  const updateMarkdown = (content: string) =>
    scribbleStore.setState((current) => ({
      ...current,
      contentById: { ...current.contentById, [doc.id]: content },
    }));
  const update = async (fields: { title?: string; icon?: string }) => {
    setError(undefined);
    try {
      await createWebviewClient<typeof scribbleCommands>(input.host.bridge).commands["scribble.pages.update"]({
        id: doc.id,
        ...fields,
      });
      await scribbleStore.refresh();
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <ScribbleEditor
      id={doc.id}
      title={doc.title}
      icon={doc.icon}
      content={markdown}
      error={error}
      onTitleChange={(title) => void update({ title })}
      onIconChange={(icon) => void update({ icon })}
      onContentChange={updateMarkdown}
      action={
        <IconButton
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          variant="ghost"
          size="sm"
          onClick={toggleFavorite}
        >
          <ExampleIcon name="Star" color={favorite ? "fg.warning" : "fg.muted"} />
        </IconButton>
      }
    />
  );
};
