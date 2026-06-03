import type { GuestHost, PropsStore } from "@pstdio/sdk/extensions";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export interface LabHostProps {
  locale?: string;
  projectId?: string;
  themePreference?: string;
  lastCommand?: {
    commandId: string;
    extensionId: string;
    outcome: { ok: boolean; status: string; value?: unknown; reason?: string };
    tick: number;
  } | null;
}

interface LabHostContextValue {
  host: GuestHost;
  propsStore: PropsStore<LabHostProps>;
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
}

const LabHostContext = createContext<LabHostContextValue | null>(null);

interface LabHostProviderProps {
  host: GuestHost;
  propsStore: PropsStore<LabHostProps>;
  t: (key: string, defaultValue?: string, args?: Record<string, unknown>) => string;
  children: ReactNode;
}

export const LabHostProvider = (props: LabHostProviderProps) => {
  const { host, propsStore, t, children } = props;
  return <LabHostContext.Provider value={{ host, propsStore, t }}>{children}</LabHostContext.Provider>;
};

export const useLabHost = () => {
  const ctx = useContext(LabHostContext);
  if (!ctx) throw new Error("useLabHost must be used inside LabHostProvider");
  return ctx;
};

/** Subscribe to the host's `propsStore` and return the current value. */
export const useLabHostProps = (): LabHostProps => {
  const { propsStore } = useLabHost();
  const [props, setProps] = useState<LabHostProps>(() => propsStore.get() ?? {});

  useEffect(() => {
    const unsubscribe = propsStore.subscribe((next) => setProps(next ?? {}));
    setProps(propsStore.get() ?? {});
    return unsubscribe;
  }, [propsStore]);

  return props;
};
