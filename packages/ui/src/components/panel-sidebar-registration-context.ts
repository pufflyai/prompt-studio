import { createContext, type Dispatch, type SetStateAction, useContext, useEffect } from "react";

export interface PanelSidebarRegistration {
  open: boolean;
  resizable: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  onOpenChange: (open: boolean) => void;
}

export const PanelSidebarRegistrationContext = createContext<Dispatch<
  SetStateAction<PanelSidebarRegistration | null>
> | null>(null);

export const usePanelSidebarRegistration = (registration: PanelSidebarRegistration) => {
  const setRegistration = useContext(PanelSidebarRegistrationContext);
  const { maxWidth, minWidth, onOpenChange, onWidthChange, open, resizable, width } = registration;

  useEffect(() => {
    if (!setRegistration) return;

    setRegistration({ maxWidth, minWidth, onOpenChange, onWidthChange, open, resizable, width });

    return () => {
      setRegistration(null);
    };
  }, [maxWidth, minWidth, onOpenChange, onWidthChange, open, resizable, setRegistration, width]);

  return setRegistration !== null;
};
