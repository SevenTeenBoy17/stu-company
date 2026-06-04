/* eslint-disable @typescript-eslint/no-explicit-any */
// Vitest 4 resolves custom-matcher types from the "vitest" module's Assertion
// interface. vitest-axe@0.1.0 only augments the legacy global `Vi` namespace, so
// we declare the matcher against Vitest 4's interface here. Runtime registration
// lives in src/test/setup.ts (expect.extend(axeMatchers)).
import "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    /** Asserts an axe-core results object contains no accessibility violations. */
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
