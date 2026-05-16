const overlayFocusAttribute = "data-overlay-return-focus";

export function markOverlayTrigger(element: HTMLElement) {
  document.querySelectorAll<HTMLElement>(`[${overlayFocusAttribute}]`).forEach((node) => {
    node.removeAttribute(overlayFocusAttribute);
  });
  element.setAttribute(overlayFocusAttribute, "true");
  element.focus();
}

export function consumeOverlayTrigger() {
  const target = document.querySelector<HTMLElement>(`[${overlayFocusAttribute}]`);
  target?.removeAttribute(overlayFocusAttribute);
  return target ?? null;
}
