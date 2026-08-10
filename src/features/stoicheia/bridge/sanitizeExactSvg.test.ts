import { describe, expect, it } from "vitest";
import { sanitizeExactSvg } from "./sanitizeExactSvg";

describe("exact SVG sanitizer", () => {
  it("preserves dvisvgm geometry and internal references", () => {
    const result = sanitizeExactSvg(`
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <defs><path id="glyph0" d="M0 0L1 1"/></defs>
        <g id="ITZ_ORIGIN" data-dvi-x="12.5" data-dvi-y="-4.25"
          data-matrix="matrix(1 0 0 1 2.5 -3)"/>
        <g transform="translate(2 3)" fill="url(#paint)">
          <use href="#glyph0"/>
          <text x="1" y="2" font-size="3">x</text>
        </g>
      </svg>
    `);

    expect(result).toContain('viewBox="0 0 10 10"');
    expect(result).toContain('href="#glyph0"');
    expect(result).toContain('fill="url(#paint)"');
    expect(result).toContain('data-dvi-x="12.5"');
    expect(result).toContain('data-dvi-y="-4.25"');
    expect(result).toContain('data-matrix="matrix(1 0 0 1 2.5 -3)"');
    expect(result).toContain("<text");
  });

  it("removes active content, handlers, external URLs, and unsafe CSS", () => {
    const result = sanitizeExactSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><iframe src="https://example.test"/></foreignObject>
        <style>@import "https://example.test/style.css";</style>
        <g onclick="alert(1)" style="background:url(javascript:alert(1))">
          <g data-dvi-x="NaN" data-dvi-y="1;alert(1)"
            data-matrix="matrix(1 0 0 1 2 javascript:alert(1))"/>
          <use href="javascript:alert(1)"/>
          <image href="https://example.test/image.png"/>
          <path d="M0 0" fill="url(https://example.test/paint)"/>
          <use href="#safe"/>
        </g>
      </svg>
    `);

    expect(result).not.toMatch(/script|foreignObject|iframe|style=/i);
    expect(result).not.toMatch(/onload|onclick|javascript:|https:/i);
    expect(result).not.toContain("url(https");
    expect(result).not.toMatch(/data-dvi-[xy]=|data-matrix=/i);
    expect(result).toContain('href="#safe"');
  });

  it("rejects malformed or non-SVG documents", () => {
    expect(sanitizeExactSvg("<html></html>")).toBe("");
    expect(sanitizeExactSvg("<svg><g></svg>")).toBe("");
    expect(sanitizeExactSvg(null)).toBe("");
  });
});
