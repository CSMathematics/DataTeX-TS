import { describe, expect, it } from "vitest";
import {
  selectGraphicsTikzpictureFromFocus,
  stringIndexToUtf8ByteOffset,
  type GraphicsTikzpictureTargetDescriptor,
} from "../../../services/packageStudioService";

const descriptor = (
  ordinal: number,
  startByte: number,
  endByte: number,
): GraphicsTikzpictureTargetDescriptor => ({
  ordinal,
  baselineRange: {
    start: { byte: startByte, line: 1, column: 1 },
    end: { byte: endByte, line: 1, column: 1 },
  },
  replacementRange: null,
  sourceSha256: `${ordinal}`.repeat(64),
  label: `Figure ${ordinal + 1}`,
  preview: `figure-${ordinal + 1}`,
  changed: false,
});

describe("Package Studio source focus", () => {
  it("converts Monaco UTF-16 string indices to UTF-8 bytes", () => {
    const source = "α😀\r\nβ";

    expect(stringIndexToUtf8ByteOffset(source, 0)).toBe(0);
    expect(stringIndexToUtf8ByteOffset(source, 1)).toBe(2);
    expect(stringIndexToUtf8ByteOffset(source, 3)).toBe(6);
    expect(stringIndexToUtf8ByteOffset(source, 5)).toBe(8);
    expect(stringIndexToUtf8ByteOffset(source, source.length)).toBe(10);
  });

  it("prefers one fully-contained selection and falls back to the cursor", () => {
    const source = "012345678901234567890123456789";
    const targets = [descriptor(0, 2, 10), descriptor(1, 15, 25)];

    expect(
      selectGraphicsTikzpictureFromFocus(
        targets,
        {
          documentId: "doc",
          source,
          cursorByte: 5,
          selectionStartByte: 24,
          selectionEndByte: 16,
        },
        "doc",
        source,
      )?.ordinal,
    ).toBe(1);

    expect(
      selectGraphicsTikzpictureFromFocus(
        targets,
        {
          documentId: "doc",
          source,
          cursorByte: 5,
          selectionStartByte: 0,
          selectionEndByte: 0,
        },
        "doc",
        source,
      )?.ordinal,
    ).toBe(0);
  });

  it("rejects stale snapshots and ambiguous/outside focus", () => {
    const source = "01234567890123456789";
    const targets = [descriptor(0, 2, 8), descriptor(1, 12, 18)];
    const focus = {
      documentId: "doc",
      source,
      cursorByte: 10,
      selectionStartByte: 6,
      selectionEndByte: 14,
    };

    expect(
      selectGraphicsTikzpictureFromFocus(
        targets,
        focus,
        "different-doc",
        source,
      ),
    ).toBeNull();
    expect(
      selectGraphicsTikzpictureFromFocus(
        targets,
        { ...focus, source: `${source}!` },
        "doc",
        source,
      ),
    ).toBeNull();
    expect(
      selectGraphicsTikzpictureFromFocus(targets, focus, "doc", source),
    ).toBeNull();
  });
});
