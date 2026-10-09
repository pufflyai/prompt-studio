import { useEffect, useState } from "react";
import { AGENT_BOARD_TASKS, type AgentTaskStage, isTaskActive, SESSION_STAGES } from "../content/agent-board-content";
import { useDemoCli } from "./use-demo-cli";

export const useAgentBoardDemo = () => {
  const [tasks, setTasks] = useState(AGENT_BOARD_TASKS);
  const [selectedId, setSelectedId] = useState("TOOL-16");
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const hostRef = useDemoCli("agents", (command) => {
    setSelectedId(command.id);
    setTasks((current) => current.map((task) => (task.id === command.id ? { ...task, stage: "coding" } : task)));
    setPlaying(true);
  });
  const active = tasks.some((task) => isTaskActive(task.stage));

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotion = () => {
      if (motion.matches) setPlaying(false);
    };
    respectMotion();
    motion.addEventListener("change", respectMotion);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(hostRef.current!);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", respectMotion);
    };
  }, [hostRef]);

  useEffect(() => {
    if (!playing || !inView || !active) return;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setTasks((current) =>
        current.map((task) => {
          if (task.stage === "queued" || task.stage === "ready") return task;
          return { ...task, stage: SESSION_STAGES[SESSION_STAGES.indexOf(task.stage) + 1] };
        }),
      );
    }, 2200);
    return () => window.clearInterval(interval);
  }, [active, playing, inView]);

  const setStage = (id: string, stage: AgentTaskStage) =>
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, stage } : task)));
  return {
    hostRef,
    tasks,
    selected: tasks.find((task) => task.id === selectedId)!,
    selectedId,
    playing,
    active,
    select: setSelectedId,
    replay: () => {
      setTasks(AGENT_BOARD_TASKS);
      setSelectedId("TOOL-16");
      setPlaying(true);
    },
    start: () => {
      setStage(selectedId, "coding");
      setPlaying(true);
    },
    finish: () => {
      setStage(selectedId, "finished");
      setPlaying(true);
    },
  };
};
