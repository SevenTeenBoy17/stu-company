import { setupServer } from "msw/node";

import { handlers } from "./handlers";

// Reusable MSW server for unit tests that exercise an outbound HTTP boundary.
// Wired per-file (server.listen in beforeAll) rather than globally, so it never
// interferes with the many tests that make no network calls. Once the remaining
// fetch-spy tests are migrated, this can move into a global tests/setup.ts.
export const server = setupServer(...handlers);
