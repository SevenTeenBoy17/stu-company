import "@testing-library/jest-dom/vitest";

import * as axeMatchers from "vitest-axe/matchers";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";

import { server } from "../../tests/msw/server";

// axe-core a11y matcher (toHaveNoViolations) available in every test.
expect.extend(axeMatchers);

// Global MSW lifecycle (TEST-STRATEGY §5.6). onUnhandledRequest "bypass" so the
// many tests that issue no requests are unaffected; each test opts in by adding
// handlers via server.use(). resetHandlers() after each test clears those opt-ins.
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom gaps relied on by animation-heavy components (framer-motion / scrollIntoView).
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
}
