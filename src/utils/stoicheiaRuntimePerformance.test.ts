import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STOICHEIA_RUNTIME_CAPTURE_FLAG,
  beginStoicheiaFrameInteraction,
  endStoicheiaFrameInteraction,
  getMissingStoicheiaRuntimePerformanceMetrics,
  initializeStoicheiaRuntimePerformanceCapture,
  markStoicheiaFirstCanvasCommit,
  markStoicheiaGraphicsModuleLoadEnd,
  markStoicheiaGraphicsModuleLoadStart,
  recordStoicheiaExactCompile,
  recordStoicheiaInteractionFrame,
  recordStoicheiaParseRoundTrip,
  recordStoicheiaRenderer,
  resetStoicheiaRuntimePerformanceCapture,
} from "./stoicheiaRuntimePerformance";

vi.mock("./debugLogger", () => ({
  debugLog: vi.fn(),
}));

describe("Stoicheia production runtime performance capture", () => {
  beforeEach(() => {
    window.localStorage.setItem(STOICHEIA_RUNTIME_CAPTURE_FLAG, "1");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    initializeStoicheiaRuntimePerformanceCapture();
  });

  afterEach(() => {
    resetStoicheiaRuntimePerformanceCapture();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("collects production milestones, IPC, renderer, and cold/warm compile metrics", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(100);
    markStoicheiaGraphicsModuleLoadStart();
    now.mockReturnValueOnce(155);
    markStoicheiaGraphicsModuleLoadEnd();
    now.mockReturnValueOnce(190);
    markStoicheiaFirstCanvasCommit();

    recordStoicheiaParseRoundTrip(4.25);
    recordStoicheiaRenderer(2.5);
    recordStoicheiaExactCompile(820, "same source", "pdflatex", true);
    recordStoicheiaExactCompile(140, "same source", "pdflatex", true);

    const snapshot = window.__DATATEX_STOICHEIA_PERF__?.snapshot();
    expect(snapshot?.metrics).toMatchObject({
      graphicsModuleLoadMs: 55,
      firstCanvasCommitMs: 90,
      parseRoundTripMs: [4.25],
      rendererMs: [2.5],
      exactCompileColdMs: 820,
      exactCompileWarmMs: 140,
    });
  });

  it("records frame intervals only between committed interaction frames", () => {
    const now = vi.spyOn(performance, "now");
    now
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(116)
      .mockReturnValueOnce(133)
      .mockReturnValueOnce(150);

    beginStoicheiaFrameInteraction("drag");
    recordStoicheiaInteractionFrame("drag");
    recordStoicheiaInteractionFrame("drag");
    endStoicheiaFrameInteraction("drag");

    expect(
      window.__DATATEX_STOICHEIA_PERF__?.snapshot()?.metrics
        .dragFrameIntervalsMs,
    ).toEqual([17]);
  });

  it("reports the exact incomplete production metric inventory", () => {
    expect(getMissingStoicheiaRuntimePerformanceMetrics()).toEqual([
      "coldStartupToFirstPaintMs",
      "graphicsModuleLoadMs",
      "firstCanvasCommitMs",
      "parseRoundTripMs",
      "rendererMs",
      "dragFrameIntervalsMs",
      "panFrameIntervalsMs",
      "zoomFrameIntervalsMs",
      "exactCompileColdMs",
      "exactCompileWarmMs",
    ]);
  });
});
