export const observeStartupPaint = (painted: () => void) => {
  const observer = new PerformanceObserver((entries) => {
    if (!entries.getEntries().some((entry) => entry.name === "first-contentful-paint")) return;
    observer.disconnect();
    painted();
  });
  observer.observe({ type: "paint", buffered: true });
  return () => observer.disconnect();
};
