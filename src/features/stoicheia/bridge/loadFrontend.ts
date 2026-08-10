let frontendPromise:
  | Promise<typeof import("./StoicheiaPackageStudioAdapter")>
  | null = null;

export const loadStoicheiaFrontend = () => {
  if (!frontendPromise) markStoicheiaGraphicsModuleLoadStart();
  frontendPromise ??= import("./StoicheiaPackageStudioAdapter")
    .then((module) => {
      markStoicheiaGraphicsModuleLoadEnd();
      return module;
    })
    .catch((error) => {
      frontendPromise = null;
      throw error;
    });
  return frontendPromise;
};
import {
  markStoicheiaGraphicsModuleLoadEnd,
  markStoicheiaGraphicsModuleLoadStart,
} from '../../../utils/stoicheiaRuntimePerformance';
