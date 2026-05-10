/**
 * QuickDuka Subscription System
 * ─────────────────────────────
 * Single source of truth for plan definitions, limits, and feature checks.
 * Designed to be easy to extend for payment integration, free trials,
 * plan upgrades, and renewals later.
 */

// ─── Plan Definitions ──────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 100,           // KES / month
    color: "#1a7a3c",
    badge: "Popular",
    description: "Perfect for a single-person shop",
    features: [
      "1 shop / branch",
      "1 user account only",
      "Basic sales tracking",
    ],
    limits: {
      maxShops: 1,
      maxStaff: 0,        // 0 = no extra staff, owner only
      multipleUsers: false,
      multipleBranches: false,
      centralAdmin: false,
      combinedReporting: false,
    },
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 250,
    color: "#0369a1",
    description: "For growing shops with a team",
    features: [
      "1 shop",
      "Multiple staff accounts",
      "Owner admin with user controls",
    ],
    limits: {
      maxShops: 1,
      maxStaff: null,     // null = unlimited
      multipleUsers: true,
      multipleBranches: false,
      centralAdmin: false,
      combinedReporting: false,
    },
  },
  business: {
    id: "business",
    name: "Business",
    price: 700,
    color: "#7c3aed",
    badge: "Best Value",
    description: "For multi-branch businesses",
    features: [
      "2+ shops / branches",
      "Multiple users across branches",
      "Central admin dashboard",
      "Combined branch reporting",
    ],
    limits: {
      maxShops: null,     // null = unlimited
      maxStaff: null,
      multipleUsers: true,
      multipleBranches: true,
      centralAdmin: true,
      combinedReporting: true,
    },
  },
};

export const PLAN_ORDER = ["starter", "growth", "business"];

// ─── Plan Helpers ──────────────────────────────────────────────────────────────

/**
 * Get a plan definition by ID. Falls back to starter if unknown.
 * @param {string} planId
 * @returns {object} plan definition
 */
export function getPlan(planId) {
  return PLANS[planId] || PLANS.starter;
}

/**
 * Get the limits object for a given plan ID.
 * @param {string} planId
 * @returns {object} limits
 */
export function getPlanLimits(planId) {
  return getPlan(planId).limits;
}

// ─── Feature Gate ──────────────────────────────────────────────────────────────

/**
 * Check whether a profile's active plan allows a specific feature.
 *
 * Usage:
 *   canUseFeature(profile, "multipleUsers")   → true | false
 *   canUseFeature(profile, "multipleBranches") → true | false
 *
 * Features:
 *   multipleUsers      — allow adding staff accounts
 *   multipleBranches   — allow adding a second shop/branch
 *   centralAdmin       — show cross-branch admin tools
 *   combinedReporting  — show combined reports
 *
 * @param {object|null} profile  Firestore user profile
 * @param {string}      feature  Key from limits object
 * @param {boolean}     isAdmin  If true, bypass all gates
 * @returns {boolean}
 */
export function canUseFeature(profile, feature, isAdmin = false) {
  if (isAdmin) return true;
  if (!profile) return false;
  const limits = getPlanLimits(profile.subscriptionPlan || "starter");
  return !!limits[feature];
}

/**
 * Check if a user can add more shops given their current plan.
 * @param {object} profile
 * @param {number} currentShopCount  How many shops/branches they already have
 * @param {boolean} isAdmin
 * @returns {boolean}
 */
export function canAddShop(profile, currentShopCount = 1, isAdmin = false) {
  if (isAdmin) return true;
  if (!profile) return false;
  const limits = getPlanLimits(profile.subscriptionPlan || "starter");
  if (limits.maxShops === null) return true;         // unlimited
  return currentShopCount < limits.maxShops;
}

/**
 * Check if a user can add more staff accounts.
 * @param {object} profile
 * @param {boolean} isAdmin
 * @returns {boolean}
 */
export function canAddStaff(profile, isAdmin = false) {
  if (isAdmin) return true;
  if (!profile) return false;
  const limits = getPlanLimits(profile.subscriptionPlan || "starter");
  return limits.multipleUsers === true;
}

// ─── Upgrade Prompt Helper ─────────────────────────────────────────────────────

/**
 * Returns the next plan up from the current one, or null if already on Business.
 * @param {string} planId
 * @returns {object|null}
 */
export function getUpgradePlan(planId) {
  const idx = PLAN_ORDER.indexOf(planId);
  if (idx === -1 || idx >= PLAN_ORDER.length - 1) return null;
  return PLANS[PLAN_ORDER[idx + 1]];
}

/**
 * Returns a human-readable message explaining why a feature is locked
 * and which plan to upgrade to.
 * @param {string} feature
 * @param {string} currentPlanId
 * @returns {string}
 */
export function getUpgradeMessage(feature, currentPlanId = "starter") {
  const upgrade = getUpgradePlan(currentPlanId);
  const messages = {
    multipleUsers: `Adding staff accounts requires the ${upgrade?.name || "Growth"} plan (KES ${upgrade?.price || 250}/mo).`,
    multipleBranches: `Managing multiple branches requires the Business plan (KES 700/mo).`,
    centralAdmin: `Central admin across branches is a Business plan feature (KES 700/mo).`,
    combinedReporting: `Combined branch reporting is a Business plan feature (KES 700/mo).`,
  };
  return messages[feature] || `Upgrade to ${upgrade?.name || "a higher plan"} to unlock this feature.`;
}

// ─── Default plan for new sign-ups ────────────────────────────────────────────
// When a user registers, they start on trial with no committed plan.
// Admin assigns the actual plan manually until payment is integrated.
export const DEFAULT_PLAN = "starter";
