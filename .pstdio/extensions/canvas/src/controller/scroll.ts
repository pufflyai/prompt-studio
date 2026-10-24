export const canScroll = (target: EventTarget | null, boundary: HTMLElement, x: number, y: number) => {
  let element = target instanceof Element ? target : null;
  while (element && element !== boundary) {
    const style = getComputedStyle(element);
    const horizontal =
      /auto|scroll/.test(style.overflowX) &&
      ((x < 0 && element.scrollLeft > 0) ||
        (x > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1));
    const vertical =
      /auto|scroll/.test(style.overflowY) &&
      ((y < 0 && element.scrollTop > 0) ||
        (y > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1));
    if ((Math.abs(x) > Math.abs(y) && horizontal) || (Math.abs(y) >= Math.abs(x) && vertical)) return true;
    element = element.parentElement;
  }
  return false;
};
export const interactive = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "input,textarea,select,button,a[href],[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=spinbutton],[role=combobox],[role=textbox]",
    ),
  );
