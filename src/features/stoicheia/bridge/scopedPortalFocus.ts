const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(host: HTMLElement) {
  return Array.from(
    host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => (
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true"
  ));
}
export function installScopedPortalFocusManagement(host: HTMLElement) {
  let restoreTarget: HTMLElement | null = null;
  let activeDialog: HTMLElement | null = null;
  let disposed = false;
  let focusScheduled = false;

  const restoreFocus = () => {
    const target = restoreTarget;
    restoreTarget = null;
    activeDialog = null;
    if (target?.isConnected) {
      target.focus({ preventScroll: true });
    }
  };

  const synchronizeDialog = () => {
    if (disposed) return;
    const nextDialog = host.querySelector<HTMLElement>('[role="dialog"]');

    if (!nextDialog) {
      if (activeDialog) restoreFocus();
      return;
    }

    if (nextDialog === activeDialog) return;
    if (!restoreTarget && document.activeElement instanceof HTMLElement) {
      restoreTarget = document.activeElement;
    }
    activeDialog = nextDialog;

    if (!activeDialog.hasAttribute("tabindex")) {
      activeDialog.tabIndex = -1;
    }
    const focusTarget = focusableElements(activeDialog)[0] ?? activeDialog;
    focusTarget.focus({ preventScroll: true });
  };

  const scheduleSynchronization = () => {
    if (focusScheduled || disposed) return;
    focusScheduled = true;
    queueMicrotask(() => {
      focusScheduled = false;
      synchronizeDialog();
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !activeDialog) return;
    const focusable = focusableElements(activeDialog);

    if (focusable.length === 0) {
      event.preventDefault();
      activeDialog.focus({ preventScroll: true });
      return;
    }

    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    focusable[nextIndex].focus({ preventScroll: true });
  };

  const observer = new MutationObserver(scheduleSynchronization);
  observer.observe(host, { childList: true, subtree: true });
  host.addEventListener("keydown", onKeyDown, true);
  scheduleSynchronization();

  return () => {
    disposed = true;
    observer.disconnect();
    host.removeEventListener("keydown", onKeyDown, true);
    restoreFocus();
  };
}
