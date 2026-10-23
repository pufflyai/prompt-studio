const controls =
  "[data-canvas-control],button,input,textarea,select,summary,a[href],[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=spinbutton],[role=combobox],[role=textbox],[role=menuitem]";

export const isCanvasControl = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(controls));

export const canScrollCanvasChild = (target: EventTarget | null, viewport: HTMLElement, x: number, y: number) => {
  let element = target instanceof Element ? target : null;
  while (element && element !== viewport) {
    const style = getComputedStyle(element);
    const horizontal =
      /auto|scroll/.test(style.overflowX) &&
      ((x < 0 && element.scrollLeft > 0) ||
        (x > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1));
    const vertical =
      /auto|scroll/.test(style.overflowY) &&
      ((y < 0 && element.scrollTop > 0) ||
        (y > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1));
    if (Math.abs(x) > Math.abs(y) ? horizontal : vertical) return true;
    element = element.parentElement;
  }
  return false;
};
