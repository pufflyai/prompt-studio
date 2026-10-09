import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { documentLinkCommand } from "../commands/document-link";
import { selectedDocumentFromResource } from "../data/document-selection";
import { DocumentLinkContent } from "./document-link-content";
import { renderTicketRoot } from "./view-root";

interface HostProps {
  resource?: ResourceRef;
}

const DocumentLink = (props: { context: ExtensionViewRenderContext<HostProps> }) => {
  const { context } = props;
  const { resource } = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const documentId = selectedDocumentFromResource(resource);
  const query = useQuery({
    queryKey: ["document-link", resource?.id, documentId],
    enabled: resource?.type === "ticket",
    queryFn: () =>
      createWebviewClient<{ "document-link": typeof documentLinkCommand }>(context.host).commands["document-link"]({
        id: resource?.id,
        file: documentId,
      }),
  });
  const href = query.data ? new URL(query.data.href, document.referrer || window.location.href).href : "";
  const label = context.t("ticketDocument.copyLink", "Copy Link");
  return <DocumentLinkContent href={href} label={label} loading={query.isPending} error={query.error?.message} />;
};

export default defineExtensionView<HostProps>({
  render(context) {
    return renderTicketRoot(context.mount, <DocumentLink context={context} />);
  },
});
