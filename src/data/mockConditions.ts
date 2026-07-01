import type { SigilStyle, ConditionVisibility, VaultState } from "@/lib/genlayer/types";

// Placeholder conditions offered as engraved hints at the Binding Altar.
export const CONDITION_PLACEHOLDERS: string[] = [
  "When this company completes its public listing.",
  "When this world record is officially broken.",
  "When this game ships its 1.0 release.",
  "When this person publicly confirms the announcement.",
  "When this film is officially released.",
];

export const CONDITION_HINTS: string[] = [
  "Write a condition the world can confirm.",
  "Avoid private knowledge. The keepers read only public traces.",
  "Once bound, the condition cannot be changed.",
];

// Drifting smoke hints used as onboarding, not a wizard.
export const SMOKE_HINTS: string[] = [
  "The wax is waiting for words.",
  "A condition tells the keepers when to open.",
  "Check the world to let the keepers look.",
  "When the world agrees, the wax melts.",
];

export interface PreloadedVault {
  title: string;
  message: string;
  recipient: string;
  sigil: SigilStyle;
  conditionText: string;
  conditionVisibility: ConditionVisibility;
  state: VaultState;
  closeness: number;
  sealedDaysAgo: number;
  lastCheckedHoursAgo: number | null;
}

// Preloaded vaults so the chamber feels inhabited from the first breath.
export const PRELOADED_VAULTS: PreloadedVault[] = [
  {
    title: "When the studio ships 1.0",
    message:
      "To whoever waited: the long build is done. Take the small key behind the third stone and finish what we started.",
    recipient: "0xKeeperOfTheWorkshop00000000000001",
    sigil: "thorn",
    conditionText: "When the studio ships its 1.0 release.",
    conditionVisibility: "public",
    state: "nearing",
    closeness: 62,
    sealedDaysAgo: 40,
    lastCheckedHoursAgo: 5,
  },
  {
    title: "When the listing is public",
    message:
      "If you are reading this, the company finally went public. The folder marked Quiet is yours now. Spend it slowly.",
    recipient: "0xKeeperOfTheLedger000000000000002",
    sigil: "anchor",
    conditionText: "When the company completes its public listing.",
    conditionVisibility: "public",
    state: "sealed",
    closeness: 0,
    sealedDaysAgo: 18,
    lastCheckedHoursAgo: null,
  },
  {
    title: "When the record is broken",
    message:
      "You did it, or you watched someone do it. Either way the wager is settled. The bottle in the cellar was always meant for this night.",
    recipient: "0xKeeperOfTheWager000000000000003",
    sigil: "hollowStar",
    conditionText: "When the long-standing world record is officially broken.",
    conditionVisibility: "public",
    state: "releasable",
    closeness: 94,
    sealedDaysAgo: 120,
    lastCheckedHoursAgo: 1,
  },
  {
    title: "When the rename is confirmed",
    message:
      "The name change went through. The old letterhead is in the bottom drawer. Burn one copy for me.",
    recipient: "0xKeeperOfTheName0000000000000004",
    sigil: "eye",
    conditionText: "When the rename is publicly confirmed by the holder.",
    conditionVisibility: "private",
    state: "listening",
    closeness: 22,
    sealedDaysAgo: 9,
    lastCheckedHoursAgo: 12,
  },
  {
    title: "When the season is announced",
    message:
      "They greenlit it after all. I told you to keep faith. Watch the first episode for me and leave the chair empty.",
    recipient: "0xKeeperOfTheChair000000000000005",
    sigil: "crescent",
    conditionText: "When the next season is officially announced.",
    conditionVisibility: "public",
    state: "dormant",
    closeness: 8,
    sealedDaysAgo: 200,
    lastCheckedHoursAgo: null,
  },
];
