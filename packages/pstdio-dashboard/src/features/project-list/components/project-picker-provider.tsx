import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { ProjectPickerModal } from "./project-picker-modal";

interface ProjectPickerContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const ProjectPickerContext = createContext<ProjectPickerContextValue | null>(null);

interface ProjectPickerProviderProps {
  children: ReactNode;
}

export const ProjectPickerProvider = (props: ProjectPickerProviderProps) => {
  const { children } = props;
  const [isOpen, setOpen] = useState(false);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <ProjectPickerContext.Provider value={{ open, close, isOpen }}>
      {children}
      <ProjectPickerModal open={isOpen} onClose={close} />
    </ProjectPickerContext.Provider>
  );
};

export const useProjectPickerContext = () => {
  const context = useContext(ProjectPickerContext);
  if (!context) {
    throw new Error("useProjectPickerContext must be used inside a ProjectPickerProvider");
  }
  return context;
};
