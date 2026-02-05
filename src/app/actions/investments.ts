"use server";

import { listHoldingsWithAccounts } from "@/db/queries/holdings";
import { listAccounts } from "@/db/queries/accounts";
import {
  getGlobalAllocationTargets,
  getAllocationTargetsByAccount,
} from "@/db/queries/allocationTargets";

export async function fetchHoldingsWithAccounts() {
  return listHoldingsWithAccounts();
}

export async function fetchAccounts(activeOnly = false) {
  return listAccounts(activeOnly);
}

export async function fetchAllocationTargets(accountId?: string) {
  if (!accountId || accountId === "all") {
    return getGlobalAllocationTargets();
  }

  const targets = getAllocationTargetsByAccount(accountId);
  // If no account-specific targets, fall back to global
  if (targets.length === 0) {
    return getGlobalAllocationTargets();
  }
  return targets;
}
