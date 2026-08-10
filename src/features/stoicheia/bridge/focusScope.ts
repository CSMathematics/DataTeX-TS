const STOICHEIA_PORTAL_SELECTOR = ".stoicheia-portal-root";

export function isStoicheiaInteractionTarget(
  target: EventTarget | null,
  workspaceRoot: HTMLElement | null,
): boolean {
  if (!(target instanceof Node)) return false;
  if (workspaceRoot?.contains(target)) return true;

  return (
    target instanceof Element &&
    target.closest(STOICHEIA_PORTAL_SELECTOR) !== null
  );
}
