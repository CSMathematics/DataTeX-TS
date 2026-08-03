let scopedPortalTarget: HTMLElement | null = null;

/**
 * Registers the portal host owned by the currently mounted Stoicheia shell.
 *
 * The returned cleanup only clears the host it registered, so a late cleanup
 * from a previous mount cannot detach a newer embedded workspace.
 */
export function registerScopedPortalTarget(target: HTMLElement): () => void {
  scopedPortalTarget = target;

  return () => {
    if (scopedPortalTarget === target) {
      scopedPortalTarget = null;
    }
  };
}

/**
 * Resolves the shared dialog target. Standalone component tests and the
 * original standalone shell continue to work by falling back to `body`.
 */
export function getScopedPortalTarget(): HTMLElement {
  if (scopedPortalTarget) {
    return scopedPortalTarget;
  }

  if (typeof document !== "undefined") {
    return document.body;
  }

  throw new Error(
    "Stoicheia dialogs require a registered portal target outside a browser document.",
  );
}
