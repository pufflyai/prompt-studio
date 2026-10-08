import { createContext, type ReactNode, useContext } from "react";

const WorkbenchConnectionContext = createContext(true);

interface WorkbenchConnectionProviderProps {
  connected: boolean;
  children: ReactNode;
}

// The host owns transport health. Views retain their data until that connection recovers.
export const WorkbenchConnectionProvider = (props: WorkbenchConnectionProviderProps) => {
  const { connected, children } = props;
  return <WorkbenchConnectionContext value={connected}>{children}</WorkbenchConnectionContext>;
};

export const useWorkbenchConnection = () => useContext(WorkbenchConnectionContext);
