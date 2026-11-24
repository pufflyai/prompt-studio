import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";

const FloatingMenuContext = createContext<{
  panel?: WorkbenchPanelRegion;
  page: boolean;
  compact: boolean;
  bounds: RefObject<HTMLDivElement | null>;
  size: { width: number; height: number };
  ids: readonly string[];
  setOpen(id: string, open: boolean, peers?: readonly string[]): void;
  headerPresent: boolean;
  setHeaderPresent(value: boolean): void;
}>({
  page: false,
  compact: false,
  bounds: { current: null },
  size: { width: 0, height: 0 },
  ids: [],
  setOpen: () => {},
  headerPresent: false,
  setHeaderPresent: () => {},
});

export const useFloatingMenu = () => useContext(FloatingMenuContext);

/** Page chrome and tab chrome share the same live owner's menu presentation. */
export const WorkbenchMenuHeaderProvider = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  children: ReactNode;
}) => {
  const { workbench, panel, children } = props;
  const owner = useWorkbenchActivePanel(workbench, panel);
  const page = panel === "main" && Boolean(owner && workbench.pages.getContent()?.widgetId === owner.widgetId);
  const bounds = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [compact, setCompact] = useState(false);
  const [headerPresent, setHeaderPresent] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const setOpen = (id: string, open: boolean, peers: readonly string[] = []) =>
    setIds((current) => {
      const next = current.filter((value) => value !== id && !peers.includes(value));
      if (open) next.push(id);
      return next.length === current.length && next.every((value, index) => value === current[index]) ? current : next;
    });
  const ownerId = owner?.widgetId;
  useEffect(() => {
    void ownerId;
    void compact;
    setIds([]);
  }, [ownerId, compact]);
  useLayoutEffect(() => {
    const content = bounds.current;
    if (!content) return;
    const parent = content.closest<HTMLElement>(`[data-workbench-panel="${panel}"]`) ?? content;
    const measure = () => {
      const width = content.clientWidth,
        height = content.clientHeight;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
      if (parent.clientWidth && parent.clientHeight)
        setCompact(parent.clientWidth <= 580 || parent.clientHeight <= 220);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [panel]);
  return (
    <FloatingMenuContext value={{ panel, page, compact, bounds, size, ids, setOpen, headerPresent, setHeaderPresent }}>
      {children}
    </FloatingMenuContext>
  );
};
