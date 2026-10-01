---
description: Accessibility (WCAG 2.2 AA / ADA) audit for an Aimee storefront - commerce checklist split into automatable and manual checks, plus layered automated testing with eslint-plugin-jsx-a11y, Lighthouse CI, and Playwright + axe-core
---

# Aimee storefront accessibility audit

You are helping the user check an Aimee storefront (Next.js +
`@aimee.shop/blocks`) against WCAG 2.2 Level AA and set up automated checks
that keep it there.

## Say this first

Tell the user plainly, before any results:

- Automated tools catch only part of WCAG. Many failures (alt text quality,
  focus order, screen reader announcements, error message clarity) need a
  human.
- No tool, test suite, or score proves WCAG conformance or ADA compliance.
  A Lighthouse 100 or zero axe violations means "no detected issues", not
  "accessible".
- Manual keyboard, screen reader, and zoom passes are required. Playwright
  with axe is the strongest automated layer here, but it does not ensure
  compliance on its own.
- This is engineering guidance, not legal advice.

## Full guide

The checklist in this skill is the core set and works offline. For the full
public guide, call `search_knowledge("storefront accessibility")`. If
knowledge search is unavailable, use the docs host from `whoami`
(production: https://docs.aimee.shop) and give the user the link
`<docs host>/docs/guides/storefront-accessibility`.

## Process

1. **Find the surface.** Locate the root layout, header/nav, product
   listing, product detail page (PDP), variant picker, quantity stepper,
   cart drawer/page, checkout, account/login, search, and CMS pages rendered
   with `BlockRenderer`.
2. **Code review.** If the `aimee-accessibility-reviewer` agent exists in
   this client, offer to run it for a report-only code review with WCAG
   criteria and severities. If it does not, walk the checklist below
   yourself and report findings as `file:line`, criterion, severity, fix.
3. **Automated layers.** Check which of the three layers below the project
   already has. Offer to add the missing ones, in order.
4. **Manual passes.** Give the user the manual-only list below as their test
   script. Offer to help interpret what they find.
5. **Report.** Automated findings, code-review findings, manual items still
   to do, and the storefront accessibility guide link. Never report
   "compliant".

## Commerce checklist

WCAG 2.2 criterion numbers in brackets.

### Automatable (lint, Lighthouse, or axe can flag it)

- Images have an `alt` attribute; icon-only buttons and links have names
  [1.1.1, 4.1.2]
- Form fields have labels; `autocomplete` values are valid [1.3.1, 1.3.5]
- Text and background contrast from theme tokens meets 4.5:1 (3:1 large)
  [1.4.3]
- `<html lang>` and a page `<title>` are present [3.1.1, 2.4.2]
- Payment and other `<iframe>`s have a `title` [4.1.2]
- ARIA roles, states, and attributes are valid; no `aria-hidden` on focusable
  content; no positive `tabindex` [4.1.2, 2.4.3]
- A `main` landmark exists, content sits in landmarks, headings are not
  empty, and heading levels do not skip [1.3.1, 2.4.1] -- these are axe
  `best-practice` rules, so include that tag
- Buttons and links are real `<button>` / `<a>` elements, not `div onClick`
  [2.1.1, 4.1.2]
- Target size of stepper and swatch buttons is at least 24x24 CSS px [2.5.8]
- Checked in interactive states only (open cart, variant changed, checkout
  errors shown) -- the Playwright layer covers these

### Manual only

- Alt text is meaningful (product name plus distinguishing detail), not just
  present [1.1.1]
- Variant radios are grouped with a group name ("Size"); no lint or axe rule
  flags ungrouped radios [1.3.1]
- Selected variant and sold-out options are announced correctly, and not
  shown by colour alone [1.4.1, 4.1.2]
- Sale price is read with context ("was $40, now $30"); strikethrough alone
  is not reliably announced [1.3.1]
- Add-to-cart, quantity changes, and cart total updates are announced by a
  live region [4.1.3]
- Cart drawer: focus moves in, `Escape` closes it, focus returns to the
  trigger [2.1.2, 2.4.3]. Keeping focus inside while open is the WAI-ARIA
  modal dialog pattern; `Escape` is what keeps that from being a trap.
- Checkout errors: clear text, tied to the field, focus moved to the error
  or summary, fix suggested [3.3.1, 3.3.3]
- Order review before purchase; billing-same-as-shipping; login allows paste
  and password managers [3.3.4, 3.3.7, 3.3.8]
- Focus is always visible [2.4.7] and never entirely hidden by a sticky
  header, cookie banner, or chat widget [2.4.11; fully visible is 2.4.12
  AAA]
- Payment iframe: can tab in and out; provider errors reach the page [2.1.1]
- Headings reflect the real structure and describe their sections,
  including CMS content [1.3.1, 2.4.6]
- **Keyboard pass**: home to order placed with keyboard only (Tab,
  Shift+Tab, Enter, Space, arrows, Escape). No traps, logical order.
- **Screen reader pass**: the same journey with VoiceOver (macOS/iOS) and
  NVDA (Windows) or TalkBack (Android).
- **Zoom 200% and 400%**: text resizes to 200% without loss [1.4.4]; at
  400% (320 CSS px wide) content reflows with no horizontal scrolling
  [1.4.10].
- **Reduced motion**: with the OS "reduce motion" setting on, animations and
  auto-advancing carousels stop or reduce. Auto-moving content must be
  pausable [2.2.2]; honouring `prefers-reduced-motion` is best practice
  (2.3.3 is AAA).

## Automated layers, in order

Add them in this order. Each layer catches things the previous one cannot.

### 1. eslint-plugin-jsx-a11y (strict)

Static JSX checks at edit time: missing alt, unlabeled controls, click
handlers on non-interactive elements, invalid ARIA. Run it as an error in CI.

```js
// eslint.config.mjs (flat config)
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // ...existing config
  jsxA11y.flatConfigs.strict,
];
```

`eslint-config-next` already registers the `jsx-a11y` plugin with a few
rules. If adding the full config errors with a duplicate plugin, keep the
existing plugin and add only the rules:
`{ rules: jsxA11y.flatConfigs.strict.rules }`.

Limits: sees source, not rendered DOM. Cannot check contrast, focus, live
regions, or `@aimee.shop/blocks` output.

### 2. Lighthouse accessibility category in Lighthouse CI

Rendered-page checks (a subset of axe rules) on key URLs in their default
state: home, a collection, a PDP, cart, checkout.

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/collections/all",
        "http://localhost:3000/products/example-product",
        "http://localhost:3000/cart",
        "http://localhost:3000/checkout"
      ],
      "startServerCommand": "npm run start"
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

Save as `lighthouserc.json` and run `npx @lhci/cli autorun` in CI after the
build. Start `minScore` at the current score and ratchet it up. Limits: page
load state only; a weighted score, not a pass/fail on WCAG.

### 3. Playwright + @axe-core/playwright (strongest automated layer)

Runs axe against real interactive states: open cart drawer, changed
variant, checkout validation errors. Also lets you assert focus behaviour
that axe cannot see.

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium
```

```ts
// e2e/a11y.spec.ts
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.0/2.1/2.2 A and AA rules, plus axe best-practice rules
// (landmarks, heading order) that WCAG tags alone do not run.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function expectNoSeriousViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const describe = (v: (typeof results.violations)[number]) =>
    `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodes) ${v.helpUrl}`;
  const isBlocking = (v: (typeof results.violations)[number]) =>
    v.impact === 'serious' || v.impact === 'critical';
  // Moderate/minor (most best-practice rules) are logged, not dropped.
  results.violations.filter((v) => !isBlocking(v)).forEach((v) => console.warn(state, describe(v)));
  expect(results.violations.filter(isBlocking).map(describe), `axe violations in state: ${state}`).toEqual([]);
}

// Adjust URLs, roles, and names to your storefront.
const PDP = '/products/example-product';

test('product page, variant change', async ({ page }) => {
  await page.goto(PDP);
  await expectNoSeriousViolations(page, 'PDP loaded');

  await page.getByRole('radio', { name: 'Large', exact: true }).check();
  await expectNoSeriousViolations(page, 'variant changed');
});

test('cart drawer open, focus returned on close', async ({ page }) => {
  await page.goto(PDP);
  const addToCart = page.getByRole('button', { name: /add to cart/i });
  await addToCart.click();

  const drawer = page.getByRole('dialog', { name: /cart/i });
  await expect(drawer).toBeVisible();
  // Needs role="status" (or <output>); a region with only aria-live will not match.
  await expect(page.getByRole('status').filter({ hasText: /added/i })).toHaveCount(1);
  await expectNoSeriousViolations(page, 'cart drawer open');

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(addToCart).toBeFocused();
});

test('checkout validation errors', async ({ page }) => {
  await page.goto(PDP);
  await page.getByRole('button', { name: /add to cart/i }).click();
  // Wait for the cart write before leaving the page.
  await expect(page.getByRole('status').filter({ hasText: /added/i })).toHaveCount(1);
  await page.goto('/checkout');
  // Assumes script validation that sets aria-invalid; adjust names to your checkout.
  await page.getByRole('button', { name: /^(continue|place order)$/i }).click();

  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expectNoSeriousViolations(page, 'checkout errors shown');
});
```

Notes:
- The test fails on `serious` and `critical` impact. Review `moderate` and
  `minor` in the report; do not silently drop them.
- If a third-party payment iframe must be excluded
  (`new AxeBuilder({ page }).exclude('iframe[name^="__privateStripeFrame"]')`),
  write down why and cover it in the manual pass and the provider's
  accessibility documentation.
- Run against a sandbox store. Never place real payments from tests.

Limits: axe rules find only part of WCAG issues and cannot judge meaning
(alt text quality, announcement wording, logical order).

## Tips

- Fix in the storefront's own components. If markup from
  `@aimee.shop/blocks` itself fails, report it to support@aimee.shop rather
  than patching `node_modules`.
- CMS content (image alt text, heading levels in rich text) is fixed in the
  admin, not in code.
- Before go-live, run this audit alongside the `launch-checklist` skill
  (`/aimee:launch-checklist`).
