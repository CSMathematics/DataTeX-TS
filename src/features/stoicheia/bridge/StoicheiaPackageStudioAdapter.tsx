import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import App from "../App";
import type { AppLanguage } from "../i18n";
import {
  useEditorStore,
  type LatexCompiler,
  type LatexEnginePaths,
} from "../store";
import type { AppTheme } from "../theme";
import "../styles/stoicheia.embedded.css";
import "./stoicheia-adapter.css";
import {
  bindHostDocumentSession,
  createHostDocumentApplyLifecycle,
  createHostDocumentApplyPayload,
  createHostSvgExportLifecycle,
  createHostSvgExportPayload,
  hostDocumentIdentity,
  type StoicheiaApplyPayload,
  type StoicheiaApplyLifecycle,
  type StoicheiaHostDocument,
  type StoicheiaSvgExportLifecycle,
  type StoicheiaSvgExportPayload,
} from "./documentBridge";
import { StoicheiaErrorBoundary } from "./StoicheiaErrorBoundary";
import { registerScopedPortalTarget } from "./scopedPortal";
import { installScopedPortalFocusManagement } from "./scopedPortalFocus";

export interface StoicheiaPackageStudioAdapterProps {
  theme: AppTheme;
  language: AppLanguage;
  latexCompiler: LatexCompiler;
  latexEnginePaths: LatexEnginePaths;
  dvisvgmPath?: string;
  hostDocument?: StoicheiaHostDocument | null;
  onBack: () => void;
  onRequestSave?: (
    payload: Readonly<StoicheiaApplyPayload>,
    lifecycle: Readonly<StoicheiaApplyLifecycle>,
  ) => void;
  onRequestSaveAs?: (
    payload: Readonly<StoicheiaApplyPayload>,
    lifecycle: Readonly<StoicheiaApplyLifecycle>,
  ) => void;
  onRequestExportSvg?: (
    payload: Readonly<StoicheiaSvgExportPayload>,
    lifecycle: Readonly<StoicheiaSvgExportLifecycle>,
  ) => void;
  onRequestApply?: (
    payload: Readonly<StoicheiaApplyPayload>,
    lifecycle: Readonly<StoicheiaApplyLifecycle>,
  ) => void;
  onRegisterHostSaveRequest?: (
    requestSave: (() => void) | null,
  ) => void;
  onRegisterHostSaveAsRequest?: (
    requestSaveAs: (() => void) | null,
  ) => void;
  onOpenHostSettings?: () => void;
}

function HostDocumentSessionBoundary({
  document,
  children,
}: {
  document: StoicheiaHostDocument | null;
  children: ReactNode;
}) {
  const identity = hostDocumentIdentity(document);
  const [readyIdentity, setReadyIdentity] = useState<string | null>(null);

  useLayoutEffect(() => {
    bindHostDocumentSession(document);
    setReadyIdentity(identity);
  }, [document?.path, document?.source, identity]);

  if (readyIdentity !== identity) {
    return (
      <div
        data-stoicheia-session-loading
        className="theme-app flex h-full w-full items-center justify-center"
        aria-busy="true"
      />
    );
  }

  return children;
}

export function StoicheiaPackageStudioAdapter(
  props: StoicheiaPackageStudioAdapterProps,
) {
  const portalHostRef = useRef<HTMLDivElement | null>(null);
  const hasActiveHostDocument =
    hostDocumentIdentity(props.hostDocument ?? null) !==
    "__datatex_no_active_document__";
  const targetKind = props.hostDocument?.target?.kind ?? "fullDocument";
  const applyActionLabel =
    targetKind === "newDrawing"
      ? "Insert into document"
      : targetKind === "tikzpicture"
        ? "Update drawing"
        : "Apply document changes";

  const requestHostDocumentAction = (
    callback:
      | StoicheiaPackageStudioAdapterProps["onRequestApply"]
      | StoicheiaPackageStudioAdapterProps["onRequestSave"]
      | StoicheiaPackageStudioAdapterProps["onRequestSaveAs"],
    nextSource: string,
  ) => {
    const payload = createHostDocumentApplyPayload(nextSource);
    if (!payload) return;
    callback?.(
      payload,
      createHostDocumentApplyLifecycle(payload),
    );
  };
  const requestHostApply = (nextSource: string) =>
    requestHostDocumentAction(props.onRequestApply, nextSource);
  const requestHostSave = (nextSource: string) =>
    requestHostDocumentAction(props.onRequestSave, nextSource);
  const requestHostSaveAs = (nextSource: string) =>
    requestHostDocumentAction(props.onRequestSaveAs, nextSource);
  const requestHostExportSvg = (
    svgSource: string,
    suggestedFileName: string,
  ) => {
    const payload = createHostSvgExportPayload(
      svgSource,
      suggestedFileName,
    );
    if (!payload) return;
    props.onRequestExportSvg?.(
      payload,
      createHostSvgExportLifecycle(payload),
    );
  };

  useEffect(() => {
    if (!props.onRegisterHostSaveRequest) return;
    if (!props.onRequestSave || !hasActiveHostDocument) {
      props.onRegisterHostSaveRequest(null);
      return;
    }
    const requestSave = () =>
      requestHostSave(useEditorStore.getState().source);
    props.onRegisterHostSaveRequest(requestSave);
    return () => props.onRegisterHostSaveRequest?.(null);
  }, [
    hasActiveHostDocument,
    props.onRegisterHostSaveRequest,
    props.onRequestSave,
  ]);

  useEffect(() => {
    if (!props.onRegisterHostSaveAsRequest) return;
    if (!props.onRequestSaveAs || !hasActiveHostDocument) {
      props.onRegisterHostSaveAsRequest(null);
      return;
    }
    const requestSaveAs = () =>
      requestHostSaveAs(useEditorStore.getState().source);
    props.onRegisterHostSaveAsRequest(requestSaveAs);
    return () => props.onRegisterHostSaveAsRequest?.(null);
  }, [
    hasActiveHostDocument,
    props.onRegisterHostSaveAsRequest,
    props.onRequestSaveAs,
  ]);

  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.className = "stoicheia-scope stoicheia-portal-root theme-app";
    host.dataset.theme = props.theme;
    host.lang = props.language;
    host.dir = props.language === "ar" ? "rtl" : "ltr";
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2000",
      pointerEvents: "none",
      background: "transparent",
    });
    document.body.appendChild(host);
    portalHostRef.current = host;

    const unregister = registerScopedPortalTarget(host);
    const removeFocusManagement = installScopedPortalFocusManagement(host);
    return () => {
      removeFocusManagement();
      unregister();
      portalHostRef.current = null;
      host.remove();
    };
  }, []);

  useEffect(() => {
    const host = portalHostRef.current;
    if (!host) return;
    host.dataset.theme = props.theme;
    host.lang = props.language;
    host.dir = props.language === "ar" ? "rtl" : "ltr";
  }, [props.language, props.theme]);

  return (
    <div
      className="stoicheia-scope stoicheia-embed-root theme-app"
      data-theme={props.theme}
      lang={props.language}
      dir={props.language === "ar" ? "rtl" : "ltr"}
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <HostDocumentSessionBoundary document={props.hostDocument ?? null}>
        <StoicheiaErrorBoundary onBack={props.onBack}>
          <App
            mode="embedded"
            theme={props.theme}
            language={props.language}
            latexCompiler={props.latexCompiler}
            latexEnginePaths={props.latexEnginePaths}
            dvisvgmPath={props.dvisvgmPath ?? ""}
            onBack={props.onBack}
            onRequestSave={
              props.onRequestSave && hasActiveHostDocument
                ? requestHostSave
                : undefined
            }
            onRequestSaveAs={
              props.onRequestSaveAs && hasActiveHostDocument
                ? requestHostSaveAs
                : undefined
            }
            onRequestExportSvg={
              props.onRequestExportSvg && hasActiveHostDocument
                ? requestHostExportSvg
                : undefined
            }
            onRequestApply={
              props.onRequestApply && hasActiveHostDocument
                ? requestHostApply
                : undefined
            }
            applyActionLabel={applyActionLabel}
            copySourceMode={
              targetKind === "fullDocument" ? "document" : "tikzpicture"
            }
            onOpenHostSettings={props.onOpenHostSettings}
          />
        </StoicheiaErrorBoundary>
      </HostDocumentSessionBoundary>
    </div>
  );
}

export default StoicheiaPackageStudioAdapter;
