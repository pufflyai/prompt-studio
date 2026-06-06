import { defineExtensionView } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import { type TicketHostProps, TicketHostProvider } from "../hooks/host-context";
import { renderTicketRoot } from "./view-root";

export const createTicketView = (renderView: () => ReactNode) =>
  defineExtensionView<TicketHostProps>({
    render({ files, mount, host, propsStore }) {
      return renderTicketRoot(
        mount,
        <TicketHostProvider files={files} host={host} propsStore={propsStore}>
          {renderView()}
        </TicketHostProvider>,
      );
    },
  });
