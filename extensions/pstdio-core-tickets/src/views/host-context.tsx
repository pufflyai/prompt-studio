import type { GuestHost, PropsStore, WebviewFilesClient } from "@pstdio/sdk/extensions";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export interface TicketResourceProp {
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

// The dashboard's bridge renderer forwards the opened resource as the guest props.
export interface TicketHostProps {
  resource?: TicketResourceProp;
}

interface TicketHostContextValue {
  files: WebviewFilesClient;
  host: GuestHost;
  propsStore: PropsStore<TicketHostProps>;
}

const TicketHostContext = createContext<TicketHostContextValue | null>(null);

interface TicketHostProviderProps {
  files: WebviewFilesClient;
  host: GuestHost;
  propsStore: PropsStore<TicketHostProps>;
  children: ReactNode;
}

export const TicketHostProvider = ({ files, host, propsStore, children }: TicketHostProviderProps) => (
  <TicketHostContext.Provider value={{ files, host, propsStore }}>{children}</TicketHostContext.Provider>
);

export const useTicketHost = () => {
  const ctx = useContext(TicketHostContext);
  if (!ctx) throw new Error("useTicketHost must be used inside TicketHostProvider");
  return ctx;
};

export const useTicketHostProps = (): TicketHostProps => {
  const { propsStore } = useTicketHost();
  const [props, setProps] = useState<TicketHostProps>(() => propsStore.get() ?? {});

  useEffect(() => {
    const unsubscribe = propsStore.subscribe((next) => setProps(next ?? {}));
    setProps(propsStore.get() ?? {});
    return unsubscribe;
  }, [propsStore]);

  return props;
};
