// Helpers for the tests of the scripts.
import type { Mock } from "vitest";

/**
 * Replaces `fetch` with a mock that answers each URL with the given body, and
 * every other URL with HTTP 404. Undo it with `vi.unstubAllGlobals()`.
 *
 * @param bodies - The response body per URL, sent as JSON
 * @returns The mock of `fetch`
 */
export function stubFetch(bodies: Record<string, object>): Mock {
  const fetchMock = vi.fn((url: string) => {
    if (!(url in bodies)) {
      return Promise.resolve({ ok: false, status: 404 });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(bodies[url]) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The URLs that the scripts read. */
export const URLS = {
  schedule: "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
  index: "https://nodejs.org/dist/index.json",
  typesNode: "https://registry.npmjs.org/@types%2fnode",
};

/** A Node release schedule as of 2026. */
export const SCHEDULE = {
  v20: { start: "2023-04-18", lts: "2023-10-24", maintenance: "2024-10-22", end: "2026-04-30" },
  v22: { start: "2024-04-24", lts: "2024-10-29", maintenance: "2025-10-21", end: "2027-04-30" },
  v24: { start: "2025-05-06", lts: "2025-10-28", maintenance: "2026-10-20", end: "2028-04-30" },
  v25: { start: "2025-10-15", maintenance: "2026-04-01", end: "2026-06-01" },
  v26: { start: "2026-05-05", lts: "2026-10-28", maintenance: "2027-10-20", end: "2029-04-30" },
  v27: { start: "2027-04-22", maintenance: "2027-10-20", end: "2030-04-30" },
};

/** Released Node versions, oldest first. */
export const RELEASES = ["20.19.0", "20.20.2", "22.11.0", "22.12.0", "22.23.3", "24.0.0", "24.21.0", "25.9.0", "26.0.0", "26.11.1"];

/** Published versions of `@types/node`. */
export const TYPES_NODE = ["20.19.1", "22.10.10", "22.12.0", "22.13.17", "24.0.4", "24.12.0", "25.5.0", "26.0.1"];

/** Answers the lookups of the scripts with the data above. */
export function stubNodeData(): void {
  stubFetch({
    [URLS.schedule]: SCHEDULE,
    [URLS.index]: [...RELEASES].reverse().map((v) => ({ version: `v${v}` })),
    [URLS.typesNode]: { versions: Object.fromEntries(TYPES_NODE.map((v) => [v, {}])) },
  });
}
