import assert from "node:assert/strict";
import test from "node:test";

import postcss from "postcss";

import {
  STOICHEIA_SCOPE,
  auditCss,
  findGlobalNamespaceLeaks,
  findScopeLeaks,
  scopeCss,
  scopeSelector,
  splitSelectorList,
} from "./lib/scope-stoicheia-css.mjs";

function selectorsIn(css) {
  const selectors = [];
  postcss.parse(css).walkRules((rule) => {
    let insideKeyframes = false;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (
        parent.type === "atrule" &&
        /(?:^|-)keyframes$/i.test(parent.name)
      ) {
        insideKeyframes = true;
        break;
      }
    }
    if (!insideKeyframes) {
      selectors.push(...splitSelectorList(rule.selector));
    }
  });
  return selectors;
}

test("splits selector lists without splitting functional or attribute commas", () => {
  assert.deepEqual(
    splitSelectorList('.item:is(.a, .b), [data-label="a,b"], button'),
    ['.item:is(.a, .b)', '[data-label="a,b"]', "button"],
  );
});

test("maps document roots and theme ownership to the embedded root", () => {
  assert.equal(scopeSelector(":root"), STOICHEIA_SCOPE);
  assert.equal(scopeSelector(":host"), STOICHEIA_SCOPE);
  assert.equal(
    scopeSelector(':root[data-theme="dark"] .panel'),
    `${STOICHEIA_SCOPE}[data-theme="dark"] .panel`,
  );
  assert.equal(
    scopeSelector("html body #root > main"),
    `${STOICHEIA_SCOPE} > main`,
  );
  assert.equal(
    scopeSelector('[data-theme="light"] .dialog'),
    `${STOICHEIA_SCOPE}[data-theme="light"] .dialog`,
  );
  assert.equal(
    scopeSelector("body.standalone"),
    `${STOICHEIA_SCOPE}.standalone`,
  );
});

test("prefixes ordinary global and component selectors", () => {
  assert.equal(
    scopeSelector("button:focus-visible"),
    `${STOICHEIA_SCOPE} button:focus-visible`,
  );
  assert.equal(scopeSelector("*"), `${STOICHEIA_SCOPE} *`);
  assert.equal(
    scopeSelector(".theme-panel :where(input, select)"),
    `${STOICHEIA_SCOPE} .theme-panel :where(input, select)`,
  );
  assert.equal(
    scopeSelector(String.raw`.\[\&\>svg\]\:h-full>svg`),
    String.raw`${STOICHEIA_SCOPE} .\[\&\>svg\]\:h-full>svg`,
  );
});

test("is idempotent for styles that are already scoped", () => {
  assert.equal(
    scopeSelector(`${STOICHEIA_SCOPE}[data-theme="dark"] .panel`),
    `${STOICHEIA_SCOPE}[data-theme="dark"] .panel`,
  );
});

test("scopes rules inside conditional at-rules but preserves keyframe steps", () => {
  const output = scopeCss(`
@media (max-width: 50rem) {
  body, .panel { display: none; }
}
@supports (display: grid) {
  #root > main { display: grid; }
}
@keyframes stoicheia-spin {
  from { transform: rotate(0); }
  50% { transform: rotate(180deg); }
  to { transform: rotate(360deg); }
}
`);

  assert.deepEqual(selectorsIn(output), [
    STOICHEIA_SCOPE,
    `${STOICHEIA_SCOPE} .panel`,
    `${STOICHEIA_SCOPE} > main`,
  ]);
  assert.match(output, /from\s*\{/);
  assert.match(output, /50%\s*\{/);
  assert.match(output, /to\s*\{/);
  assert.doesNotMatch(output, /\.stoicheia-scope from/);
});

test("retains compiled global definitions without treating keyframe steps as leaks", () => {
  const output = scopeCss(`
@font-face { font-family: "Stoicheia"; src: url(stoicheia.woff2); }
@property --stoicheia-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@-webkit-keyframes fade { from { opacity: 0; } to { opacity: 1; } }
:root { --embedded-animation: fade 120ms ease-out; }
.canvas { animation: var(--embedded-animation); }
`);

  assert.match(output, /@font-face/);
  assert.match(output, /@property --stoicheia-angle/);
  assert.match(output, /@-webkit-keyframes stoicheia-fade/);
  assert.match(output, /--embedded-animation: stoicheia-fade 120ms ease-out/);
  assert.deepEqual(findScopeLeaks(postcss.parse(output)), []);
  assert.equal(scopeCss(output), output);
});

test("namespaces Tailwind custom properties and cascade layer owners", () => {
  const output = scopeCss(`
@layer properties;
@layer theme, base, components, utilities;
@layer utilities {
  :root {
    --tw-shadow: 0 1px var(--tw-shadow-color);
  }
  .card {
    box-shadow: var(--tw-shadow);
    transition-property: color, --tw-gradient-from, --tw-gradient-to;
  }
}
@property --tw-shadow {
  syntax: "*";
  inherits: false;
}
`);
  const audit = auditCss(output);

  assert.match(output, /@layer stoicheia-properties;/);
  assert.match(
    output,
    /@layer stoicheia-theme, stoicheia-base, stoicheia-components, stoicheia-utilities;/,
  );
  assert.match(output, /@layer stoicheia-utilities\s*\{/);
  assert.match(output, /@property --stoicheia-tw-shadow/);
  assert.match(output, /var\(--stoicheia-tw-shadow-color\)/);
  assert.match(
    output,
    /transition-property: color, --stoicheia-tw-gradient-from, --stoicheia-tw-gradient-to/,
  );
  assert.doesNotMatch(output, /--tw-/);
  assert.deepEqual(audit.globalNamespaceLeaks, []);
  assert.deepEqual(audit.namespacedGlobals.cascadeLayers, [
    "stoicheia-base",
    "stoicheia-components",
    "stoicheia-properties",
    "stoicheia-theme",
    "stoicheia-utilities",
  ]);
  assert.deepEqual(audit.namespacedGlobals.tailwindCustomProperties, [
    "--stoicheia-tw-gradient-from",
    "--stoicheia-tw-gradient-to",
    "--stoicheia-tw-shadow",
    "--stoicheia-tw-shadow-color",
  ]);
  assert.equal(scopeCss(output), output);
});

test("audit detects unnamespaced Tailwind globals before transformation", () => {
  const root = postcss.parse(`
@layer utilities {
  :root { --tw-ring-color: blue; }
}
@property --tw-ring-color {
  syntax: "<color>";
  inherits: false;
}
`);
  const leaks = findGlobalNamespaceLeaks(root);

  assert.deepEqual(
    [...new Set(leaks.map((leak) => leak.kind))].sort(),
    ["layer", "property", "tailwind-custom-property"],
  );
  assert.ok(
    leaks.some(
      (leak) =>
        leak.kind === "tailwind-custom-property" &&
        leak.value === "--tw-ring-color",
    ),
  );
  assert.ok(
    leaks.some(
      (leak) => leak.kind === "layer" && leak.value === "utilities",
    ),
  );
});

test("rejects future document-global definitions without a Stoicheia namespace", () => {
  assert.throws(
    () =>
      scopeCss(`
@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.shape { transform: rotate(var(--angle)); }
`),
    /Global CSS namespace validation failed for property "--angle"/,
  );
  assert.throws(
    () =>
      scopeCss(`
@font-face { font-family: "Shared UI"; src: url(shared.woff2); }
.label { font-family: "Shared UI"; }
`),
    /Global CSS namespace validation failed for font-face/,
  );
  assert.throws(
    () =>
      scopeCss(`
@counter-style symbols { system: cyclic; symbols: "*"; }
.list { list-style: symbols; }
`),
    /Global CSS namespace validation failed for counter-style "symbols"/,
  );
});

test("rejects imports, nesting, CSS Modules escapes, and root ancestors", () => {
  assert.throws(
    () => scopeCss('@import "tailwindcss"; .panel { color: red; }'),
    /@import is not allowed/,
  );
  assert.throws(
    () => scopeCss(".parent { & .child { color: red; } }"),
    /Uncompiled nested selector/,
  );
  assert.throws(
    () => scopeCss(":global(.foreign) { color: red; }"),
    /would escape/,
  );
  assert.throws(
    () => scopeCss(".external body .panel { color: red; }"),
    /root anchor must be the leading selector compound/,
  );
});

test("leak detector identifies selectors that bypass the boundary", () => {
  const root = postcss.parse(`
${STOICHEIA_SCOPE} .safe { color: green; }
.unsafe { color: red; }
@keyframes safe-animation { from { opacity: 0; } to { opacity: 1; } }
`);
  assert.deepEqual(findScopeLeaks(root), [
    {
      kind: "selector",
      value: ".unsafe",
      line: 3,
    },
  ]);
});
