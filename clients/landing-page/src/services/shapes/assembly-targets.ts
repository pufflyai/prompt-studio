const scrollFrame = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const scaleX = rect.width / element.offsetWidth;
  const scaleY = rect.height / element.offsetHeight;
  const left = rect.left + element.clientLeft * scaleX;
  const top = rect.top + element.clientTop * scaleY;
  return {
    left,
    right: left + element.clientWidth * scaleX,
    top,
    bottom: top + element.clientHeight * scaleY,
    scaleX,
    scaleY,
  };
};

const revealAxis = (start: number, end: number, frameStart: number, frameEnd: number) => {
  if (end - start > frameEnd - frameStart && start < frameEnd && end > frameStart) return 0;
  if (end > frameEnd) return end - frameEnd;
  if (start < frameStart) return start - frameStart;
  return 0;
};

/** Walk outwards so each scroll reveals the control in the next containing viewport. */
export const revealAssemblyTarget = (preview: HTMLElement, element: HTMLElement, editingEnd: boolean) => {
  for (let parent = element.parentElement; parent && preview.contains(parent); parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const frame = scrollFrame(parent);
    const target = element.getBoundingClientRect();
    if (parent.scrollWidth > parent.clientWidth && !["visible", "clip"].includes(style.overflowX)) {
      parent.scrollLeft += revealAxis(target.left, target.right, frame.left, frame.right) / frame.scaleX;
    }
    if (parent.scrollHeight > parent.clientHeight && !["visible", "clip"].includes(style.overflowY)) {
      const top = editingEnd
        ? target.bottom - Number.parseFloat(getComputedStyle(element).lineHeight) * frame.scaleY
        : target.top;
      parent.scrollTop += revealAxis(top, target.bottom, frame.top, frame.bottom) / frame.scaleY;
    }
  }
};

export const assemblyTargetPoint = (
  scene: SVGSVGElement,
  preview: HTMLElement,
  element: HTMLElement,
  typing: boolean,
) => {
  if (!element.isConnected) return undefined;
  let { left, right, top, bottom } = element.getBoundingClientRect();
  for (let parent = element.parentElement; parent && preview.contains(parent); parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const frame = scrollFrame(parent);
    if (style.overflowX !== "visible") {
      left = Math.max(left, frame.left);
      right = Math.min(right, frame.right);
    }
    if (style.overflowY !== "visible") {
      top = Math.max(top, frame.top);
      bottom = Math.min(bottom, frame.bottom);
    }
  }
  if (right <= left || bottom <= top) return undefined;
  const point = new DOMPoint(
    typing ? left + Math.min(30, (right - left) / 2) : (left + right) / 2,
    (top + bottom) / 2,
  ).matrixTransform(scene.getScreenCTM()!.inverse());
  return { x: point.x - 5, y: point.y - 5 };
};
