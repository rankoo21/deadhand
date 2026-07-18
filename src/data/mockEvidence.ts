// Mock public-evidence snapshots offered at the Vault Hall when a keeper checks
// the world. Some snapshots are strong enough to move a vault to releasable,
// others only nudge it nearer, and some are pure noise.

export interface EvidenceTemplate {
  label: string;
  sourceUri: string;
  snapshot: string;
  // A short hint about how this snapshot tends to read, for the UI only.
  tone: "confirming" | "approaching" | "quiet";
}

export const EVIDENCE_TEMPLATES: EvidenceTemplate[] = [
  {
    label: "Press archive",
    sourceUri: "https://example.com/public-release-record",
    snapshot:
      "The studio officially shipped and released its 1.0 build today; the launch is confirmed and live to the public.",
    tone: "confirming",
  },
  {
    label: "Listing notice",
    sourceUri: "https://example.com/public-listing-record",
    snapshot:
      "The company completed its public listing this morning; shares are confirmed trading and the listing is now public.",
    tone: "confirming",
  },
  {
    label: "Record board",
    sourceUri: "https://example.com/official-record-board",
    snapshot:
      "The long-standing world record was officially broken at the event and the new mark has been confirmed by officials.",
    tone: "confirming",
  },
  {
    label: "Studio teaser",
    sourceUri: "https://example.com/studio-release-teaser",
    snapshot:
      "The studio teased an upcoming 1.0 release window for the game; a launch is expected soon but is not yet confirmed.",
    tone: "approaching",
  },
  {
    label: "Filing rumor",
    sourceUri: "https://example.com/unconfirmed-filing",
    snapshot:
      "Reports suggest the company is planning an upcoming public listing; the offering is expected but nothing is confirmed.",
    tone: "approaching",
  },
  {
    label: "Quiet feed",
    sourceUri: "https://example.com/unrelated-public-feed",
    snapshot:
      "Unrelated chatter about the weather, lunch plans, and a slow afternoon. Nothing touches the condition at all.",
    tone: "quiet",
  },
];

// A guaranteed strong snapshot keyed to a condition string, used by the demo so
// a chosen vault can be advanced from sealed toward releasable convincingly.
export function strongEvidenceFor(condition: string): EvidenceTemplate {
  const c = condition.toLowerCase();
  if (c.includes("listing") || c.includes("public")) return EVIDENCE_TEMPLATES[1];
  if (c.includes("record")) return EVIDENCE_TEMPLATES[2];
  if (c.includes("season") || c.includes("announce")) {
    return {
      label: "Announcement wire",
      sourceUri: "https://example.com/official-season-announcement",
      snapshot:
        "The next season was officially announced today; the renewal is confirmed and public.",
      tone: "confirming",
    };
  }
  if (c.includes("rename") || c.includes("name")) {
    return {
      label: "Registry notice",
      sourceUri: "https://example.com/public-registry-notice",
      snapshot:
        "The rename was publicly confirmed by the holder today; the change is official and now public.",
      tone: "confirming",
    };
  }
  return EVIDENCE_TEMPLATES[0];
}
