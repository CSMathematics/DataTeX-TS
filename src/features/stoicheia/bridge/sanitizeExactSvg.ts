const SAFE_ELEMENTS = new Set([
  "circle",
  "clippath",
  "defs",
  "ellipse",
  "g",
  "image",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "svg",
  "symbol",
  "text",
  "tspan",
  "use",
]);

const SAFE_ATTRIBUTES = new Set([
  "aria-hidden",
  "class",
  "clip-path",
  "clip-rule",
  "cx",
  "cy",
  "d",
  "data-dvi-x",
  "data-dvi-y",
  "data-matrix",
  "data-text",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-weight",
  "fr",
  "fx",
  "fy",
  "gradienttransform",
  "gradientunits",
  "height",
  "href",
  "id",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "offset",
  "opacity",
  "overflow",
  "points",
  "preserveaspectratio",
  "r",
  "refx",
  "refy",
  "role",
  "rx",
  "ry",
  "spreadmethod",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "transform",
  "vector-effect",
  "version",
  "viewbox",
  "width",
  "x",
  "x1",
  "x2",
  "xlink:href",
  "xml:space",
  "xmlns",
  "xmlns:xlink",
  "y",
  "y1",
  "y2",
]);

const URL_VALUE_ATTRIBUTES = new Set([
  "clip-path",
  "fill",
  "filter",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke",
]);

const SAFE_LOCAL_URL = /^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/;
const SAFE_FRAGMENT = /^#[A-Za-z_][\w:.-]*$/;
const SAFE_RASTER_DATA =
  /^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const SAFE_NUMBER =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function isSafeHref(value: string) {
  const normalized = value.trim();
  return SAFE_FRAGMENT.test(normalized) || SAFE_RASTER_DATA.test(normalized);
}

function isSafeUrlValue(value: string) {
  return !/url\s*\(/i.test(value) || SAFE_LOCAL_URL.test(value.trim());
}

function isSafeMatrix(value: string) {
  const match = value.trim().match(/^matrix\(([^)]+)\)$/);
  if (!match) return false;
  const parts = match[1].trim().split(/[\s,]+/);
  return parts.length === 6 && parts.every((part) => (
    SAFE_NUMBER.test(part) && Number.isFinite(Number(part))
  ));
}

export function sanitizeExactSvg(source: string | null | undefined) {
  if (!source?.trim() || typeof DOMParser === "undefined") return "";

  try {
    const documentNode = new DOMParser().parseFromString(
      source,
      "image/svg+xml",
    );
    if (documentNode.querySelector("parsererror")) return "";

    const root = documentNode.documentElement;
    if (root.localName.toLowerCase() !== "svg") return "";

    const elements = [
      root,
      ...Array.from(root.querySelectorAll<SVGElement>("*")),
    ];

    for (const element of elements) {
      if (!SAFE_ELEMENTS.has(element.localName.toLowerCase())) {
        element.remove();
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (
          name.startsWith("on") ||
          !SAFE_ATTRIBUTES.has(name) ||
          ((name === "data-dvi-x" || name === "data-dvi-y") &&
            (!SAFE_NUMBER.test(value.trim()) ||
              !Number.isFinite(Number(value)))) ||
          (name === "data-matrix" && !isSafeMatrix(value)) ||
          ((name === "href" || name === "xlink:href") &&
            !isSafeHref(value)) ||
          (URL_VALUE_ATTRIBUTES.has(name) && !isSafeUrlValue(value))
        ) {
          element.removeAttributeNode(attribute);
        }
      }
    }

    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return "";
  }
}
