let frontendPromise:
  | Promise<typeof import("./StoicheiaPackageStudioAdapter")>
  | null = null;

export const loadStoicheiaFrontend = () => {
  frontendPromise ??= import("./StoicheiaPackageStudioAdapter")
    .catch((error) => {
      frontendPromise = null;
      throw error;
    });
  return frontendPromise;
};
