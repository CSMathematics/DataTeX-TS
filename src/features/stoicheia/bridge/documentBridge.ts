import { useEditorStore } from "../store";
import { sanitizeExactSvg } from "./sanitizeExactSvg";

export interface StoicheiaHostDocument {
  readonly sessionId: string;
  readonly id: string;
  readonly path: string;
  readonly source: string;
  /**
   * Optional target-local source presented to the copied Stoicheia runtime.
   * `source` always remains the immutable full DataTeX document baseline.
   */
  readonly workingSource?: string;
  readonly target?: StoicheiaEditTarget;
}

export type StoicheiaEditTarget =
  | Readonly<{ kind: "fullDocument" }>
  | Readonly<{ kind: "tikzpicture"; ordinal: number }>
  | Readonly<{ kind: "newDrawing" }>;

export interface StoicheiaDocumentSession {
  readonly sessionId: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly sourceRevision: string;
  readonly baselineSource: string;
  readonly target: StoicheiaEditTarget;
}

/**
 * Immutable request handed from the embedded Stoicheia editor to DataTeX.
 *
 * The baseline is intentionally included verbatim. The host can therefore
 * reject a stale request or construct a reviewed edit without reading mutable
 * Stoicheia state after the user presses Apply.
 */
export interface StoicheiaApplyPayload {
  readonly sessionId: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly baselineSource: string;
  readonly sourceRevision: string;
  readonly nextSource: string;
  readonly target: StoicheiaEditTarget;
}

export interface StoicheiaApplyLifecycle {
  readonly validate: () => boolean;
  readonly commit: (appliedSource?: string) => boolean;
  readonly validateCommitted: (appliedSource?: string) => boolean;
}

export interface StoicheiaSvgExportPayload {
  readonly sessionId: string;
  readonly documentId: string;
  readonly filePath: string;
  readonly sourceRevision: string;
  readonly source: string;
  readonly svgRevision: string;
  readonly svgSource: string;
  readonly suggestedFileName: string;
  readonly target: StoicheiaEditTarget;
}

export interface StoicheiaSvgExportLifecycle {
  readonly validate: () => boolean;
}

const MAX_HOST_SVG_EXPORT_BYTES = 25 * 1024 * 1024;

let sessionInitialized = false;
let activeSession: StoicheiaDocumentSession | null = null;
let activeSessionIdentity: string | null = null;
let localDraftRevision = 0;
let hostSourceResetDepth = 0;

// Zustand source changes are synchronous. Count only authoring changes; host
// hydration/reset is an expected session transition and must not make a
// post-commit Save As look like a newer user draft.
useEditorStore.subscribe((state, previousState) => {
  if (
    hostSourceResetDepth === 0 &&
    state.source !== previousState.source
  ) {
    localDraftRevision += 1;
  }
});

const documentIdentity = (document: StoicheiaHostDocument | null) => {
  const sessionId = document?.sessionId.trim();
  const documentId = document?.id.trim();
  const target =
    document?.target?.kind === "tikzpicture"
      ? `tikzpicture:${document.target.ordinal}`
      : document?.target?.kind ?? "fullDocument";
  return sessionId && documentId
    ? JSON.stringify([sessionId, documentId, target])
    : null;
};

export const hostDocumentIdentity = (
  document: StoicheiaHostDocument | null,
) => documentIdentity(document) ?? "__datatex_no_active_document__";

export const fingerprintDocumentSource = (source: string) => {
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(source);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${bytes.length}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const filenameFromPath = (path: string) =>
  path.split(/[/\\]/).pop()?.trim() || "source.tex";

const freezeTarget = (
  target: StoicheiaEditTarget | undefined,
): StoicheiaEditTarget =>
  Object.freeze(
    target?.kind === "tikzpicture"
      ? { kind: "tikzpicture" as const, ordinal: target.ordinal }
      : target?.kind === "newDrawing"
        ? { kind: "newDrawing" as const }
        : { kind: "fullDocument" as const },
  );

const targetsMatch = (
  left: StoicheiaEditTarget,
  right: StoicheiaEditTarget,
) =>
  left.kind === right.kind &&
  (left.kind !== "tikzpicture" ||
    (right.kind === "tikzpicture" && left.ordinal === right.ordinal));

const resetDocumentState = (
  document: StoicheiaHostDocument | null,
) => {
  const state = useEditorStore.getState();
  hostSourceResetDepth += 1;
  try {
    useEditorStore.setState({
      documentFilename: document ? filenameFromPath(document.path) : "source.tex",
      source: document?.workingSource ?? document?.source ?? "",
      sourceHistory: [],
      sourceRedoStack: [],
      svgOutput: null,
      compiledSource: null,
      isCompiling: false,
      errorLog: null,
      autosaveError: null,
      parsedNodes: [],
      parsedSource: "",
      resolvedPoints: null,
      resolvedViewport: null,
      geometryDiagnostics: [],
      performanceMetrics: null,
      activeTool: "cursor",
      selectedPoints: [],
      hoveredNode: null,
      selectedNode: null,
      zoomLevel: state.settings.defaultZoom,
      pan: { x: 0, y: 0 },
      fitViewRequest: 0,
    });
  } finally {
    hostSourceResetDepth -= 1;
  }
};

export const bindHostDocumentSession = (
  document: StoicheiaHostDocument | null,
): StoicheiaDocumentSession | null => {
  const nextIdentity = documentIdentity(document);
  const normalizedDocument = nextIdentity ? document : null;

  // Preserve an unapplied local Stoicheia draft when the same host document
  // remounts within one Package Studio lifetime. Reopening Package Studio gets
  // a new session id and therefore reloads the latest DataTeX source.
  if (sessionInitialized && activeSessionIdentity === nextIdentity) {
    return activeSession;
  }

  resetDocumentState(normalizedDocument);
  sessionInitialized = true;
  activeSessionIdentity = nextIdentity;
  activeSession = normalizedDocument
    ? Object.freeze({
        sessionId: normalizedDocument.sessionId.trim(),
        documentId: normalizedDocument.id.trim(),
        filePath: normalizedDocument.path,
        sourceRevision: fingerprintDocumentSource(normalizedDocument.source),
        baselineSource: normalizedDocument.source,
        target: freezeTarget(normalizedDocument.target),
      })
    : null;
  return activeSession;
};

export const getHostDocumentSession = () => activeSession;

/**
 * Captures an Apply request against the immutable host snapshot that seeded
 * the active session. Returning null is deliberate: standalone/no-document
 * Stoicheia sessions must never be able to mutate a DataTeX document.
 */
export const createHostDocumentApplyPayload = (
  nextSource: string,
): Readonly<StoicheiaApplyPayload> | null => {
  const session = activeSession;
  if (!session) return null;

  return Object.freeze({
    sessionId: session.sessionId,
    documentId: session.documentId,
    filePath: session.filePath,
    baselineSource: session.baselineSource,
    sourceRevision: session.sourceRevision,
    nextSource,
    target: session.target,
  });
};

export const createCurrentHostDocumentApplyPayload = () =>
  createHostDocumentApplyPayload(useEditorStore.getState().source);

/**
 * Checks that a frozen request still belongs to the active target/session.
 * This is deliberately non-mutating so the host can call it immediately
 * before applying a reviewed edit.
 */
export const validateHostDocumentApply = (
  payload: Readonly<StoicheiaApplyPayload>,
): boolean => {
  const session = activeSession;
  return Boolean(
    session &&
      payload.sessionId === session.sessionId &&
      payload.documentId === session.documentId &&
      payload.filePath === session.filePath &&
      payload.baselineSource === session.baselineSource &&
      payload.sourceRevision === session.sourceRevision &&
      targetsMatch(payload.target, session.target),
  );
};

/**
 * Advances the full-document bridge baseline only after DataTeX confirms that
 * the reviewed edit was applied. Range-safe edits pass the actual full host
 * source, while full-document edits use `payload.nextSource`.
 */
export const commitHostDocumentApply = (
  payload: Readonly<StoicheiaApplyPayload>,
  appliedSource = payload.nextSource,
): boolean => {
  const session = activeSession;
  if (
    !session ||
    !validateHostDocumentApply(payload)
  ) {
    return false;
  }

  activeSession = Object.freeze({
    ...session,
    baselineSource: appliedSource,
    sourceRevision: fingerprintDocumentSource(appliedSource),
  });
  return true;
};

export const createHostDocumentApplyLifecycle = (
  payload: Readonly<StoicheiaApplyPayload>,
): Readonly<StoicheiaApplyLifecycle> => {
  const draftRevision = localDraftRevision;
  let committedSource: string | null = null;
  return Object.freeze({
    validate: () =>
      localDraftRevision === draftRevision &&
      validateHostDocumentApply(payload) &&
      useEditorStore.getState().source === payload.nextSource,
    commit: (appliedSource = payload.nextSource) => {
      if (
        localDraftRevision !== draftRevision ||
        useEditorStore.getState().source !== payload.nextSource ||
        !commitHostDocumentApply(payload, appliedSource)
      ) {
        return false;
      }
      committedSource = appliedSource;
      return true;
    },
    validateCommitted: (appliedSource = payload.nextSource) =>
      localDraftRevision === draftRevision &&
      committedSource === appliedSource,
  });
};

export const validateHostSvgExport = (
  payload: Readonly<StoicheiaSvgExportPayload>,
): boolean => {
  const session = activeSession;
  const state = useEditorStore.getState();
  const currentSvg = state.svgOutput;
  return Boolean(
    session &&
      currentSvg &&
      payload.sessionId === session.sessionId &&
      payload.documentId === session.documentId &&
      payload.filePath === session.filePath &&
      payload.sourceRevision === session.sourceRevision &&
      targetsMatch(payload.target, session.target) &&
      state.source === payload.source &&
      state.compiledSource === payload.source &&
      !state.isCompiling &&
      fingerprintDocumentSource(currentSvg) === payload.svgRevision,
  );
};

export const createHostSvgExportPayload = (
  svgSource: string,
  suggestedFileName: string,
): Readonly<StoicheiaSvgExportPayload> | null => {
  const session = activeSession;
  const state = useEditorStore.getState();
  if (
    !session ||
    !state.svgOutput ||
    state.svgOutput !== svgSource ||
    state.compiledSource !== state.source ||
    state.isCompiling ||
    new TextEncoder().encode(svgSource).byteLength >
      MAX_HOST_SVG_EXPORT_BYTES
  ) {
    return null;
  }

  const sanitizedSvg = sanitizeExactSvg(svgSource);
  if (!sanitizedSvg) return null;

  return Object.freeze({
    sessionId: session.sessionId,
    documentId: session.documentId,
    filePath: session.filePath,
    sourceRevision: session.sourceRevision,
    source: state.source,
    svgRevision: fingerprintDocumentSource(svgSource),
    svgSource: sanitizedSvg.endsWith("\n")
      ? sanitizedSvg
      : `${sanitizedSvg}\n`,
    suggestedFileName,
    target: freezeTarget(session.target),
  });
};

export const createHostSvgExportLifecycle = (
  payload: Readonly<StoicheiaSvgExportPayload>,
): Readonly<StoicheiaSvgExportLifecycle> =>
  Object.freeze({
    validate: () => validateHostSvgExport(payload),
  });

export const resetHostDocumentBridgeForTests = () => {
  sessionInitialized = false;
  activeSession = null;
  activeSessionIdentity = null;
  localDraftRevision = 0;
  hostSourceResetDepth = 0;
};
