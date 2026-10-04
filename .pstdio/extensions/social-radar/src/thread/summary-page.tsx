import { Box } from "@chakra-ui/react";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage, EmptyState, ScrollArea } from "@pstdio/ui";
import { isNewPost } from "../schemas";
import { threadResource } from "../store";
import { useOpenThread, useRadar, useRadarRefresh, useRadarResource } from "../webview/client";
import { PostInsights, ThreadInsights } from "./insights";

/** The thread page's right menu: the summary of a thread, or why the agent suggested a new post. */
export const SummaryPage = () => {
  const resource = useRadarResource();
  if (!resource) return <EmptyState title="No thread open" description="Pick a thread in the thread list." />;
  return <Summary key={resource.id} id={resource.id} />;
};

const Summary = (props: { id: string }) => {
  const { id } = props;
  const { client } = useRadar();
  const openThread = useOpenThread();
  useRadarRefresh();
  const data = useCommandQuery({ queryKey: ["thread", id], command: () => client.commands["get-thread"]({ id }) });
  if (!data.data) return data.error ? <AlertMessage status="error" title={data.error.message} /> : null;
  const { thread, sourceTitles } = data.data;
  return (
    <ScrollArea h="full">
      <Box p="md">
        {isNewPost(thread) ? (
          <PostInsights
            post={thread}
            sourceTitles={sourceTitles}
            onOpenSource={(source) => openThread({ type: threadResource.id, id: source, label: sourceTitles[source] })}
          />
        ) : (
          <ThreadInsights thread={thread} />
        )}
      </Box>
    </ScrollArea>
  );
};
