/**
 * useSubscription — React hook for subscription-aware feature gating.
 *
 * Usage:
 *   const sub = useSubscription(profile, isAdmin);
 *
 *   sub.plan          // "starter" | "growth" | "business"
 *   sub.planDef       // full plan object (name, price, features, limits)
 *   sub.can("multipleUsers")      // boolean
 *   sub.can("multipleBranches")   // boolean
 *   sub.can("centralAdmin")       // boolean
 *   sub.can("combinedReporting")  // boolean
 *   sub.canAddShop(currentCount)  // boolean
 *   sub.canAddStaff()             // boolean
 *   sub.upgradeMsg("multipleUsers") // human-readable locked message
 *   sub.upgradePlan               // next plan def, or null if on Business
 *
 * This hook is the single place you import in components — no need to import
 * multiple helpers from subscription.js directly.
 */
import { useMemo } from "react";
import {
  getPlan,
  canUseFeature,
  canAddShop,
  canAddStaff,
  getUpgradePlan,
  getUpgradeMessage,
} from "../subscription";

export function useSubscription(profile, isAdmin = false) {
  return useMemo(() => {
    const planId = profile?.subscriptionPlan || "starter";
    const planDef = getPlan(planId);

    return {
      plan: planId,
      planDef,
      status: profile?.subscriptionStatus || "trial",

      /** Feature gate — pass a limits key */
      can: (feature) => canUseFeature(profile, feature, isAdmin),

      /** Shop/branch count gate */
      canAddShop: (currentCount) => canAddShop(profile, currentCount, isAdmin),

      /** Staff gate */
      canAddStaff: () => canAddStaff(profile, isAdmin),

      /** Human-readable upgrade prompt */
      upgradeMsg: (feature) => getUpgradeMessage(feature, planId),

      /** Next tier up, or null */
      upgradePlan: getUpgradePlan(planId),
    };
  }, [profile, isAdmin]);
}
