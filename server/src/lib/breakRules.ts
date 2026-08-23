// Tiered break-time rules: "once you've worked at least N minutes, you need
// at least M minutes of break." Lets each user model their local labor law
// (e.g. Germany's ArbZG §4: 30min break after 6h, 45min after 9h) instead of
// relying on a single flat break value.

export interface BreakRule {
  afterMinutes: number;
  breakMinutes: number;
}

// German statutory minimum breaks (Arbeitszeitgesetz §4): >6h worked needs
// 30min break; >9h needs 45min total. Offered as a one-click preset in the UI.
export const GERMAN_BREAK_RULES: BreakRule[] = [
  { afterMinutes: 360, breakMinutes: 30 },
  { afterMinutes: 540, breakMinutes: 45 },
];

/** Parses the JSON blob stored in users.break_rules. Null/empty => no rules configured. */
export function parseBreakRules(json: string | null): BreakRule[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as BreakRule[]) : null;
  } catch {
    return null;
  }
}

/** Serializes rules for storage. An empty/null list is stored as NULL (rules disabled). */
export function serializeBreakRules(rules: BreakRule[] | null): string | null {
  return rules && rules.length > 0 ? JSON.stringify(rules) : null;
}

/**
 * Validates and normalizes rule input from a request body.
 * Returns null for null/empty input (disables rules). Throws on malformed input.
 */
export function validateBreakRules(input: unknown): BreakRule[] | null {
  if (input === null || input === undefined) return null;
  if (!Array.isArray(input)) throw new Error("Break rules must be an array");
  const rules = input.map((r) => {
    if (typeof r !== "object" || r === null) throw new Error("Each break rule must be an object");
    const afterMinutes = Number((r as Record<string, unknown>).afterMinutes);
    const breakMinutes = Number((r as Record<string, unknown>).breakMinutes);
    if (!Number.isFinite(afterMinutes) || afterMinutes < 0) {
      throw new Error("Each rule's afterMinutes must be a non-negative number");
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
      throw new Error("Each rule's breakMinutes must be a non-negative number");
    }
    return { afterMinutes: Math.round(afterMinutes), breakMinutes: Math.round(breakMinutes) };
  });
  rules.sort((a, b) => a.afterMinutes - b.afterMinutes);
  return rules.length > 0 ? rules : null;
}

/** Returns the minimum break required (in minutes) for a shift of the given gross duration. */
export function requiredBreakMinutes(grossMinutes: number, rules: BreakRule[] | null): number {
  if (!rules) return 0;
  let result = 0;
  for (const rule of rules) {
    if (grossMinutes >= rule.afterMinutes && rule.breakMinutes > result) {
      result = rule.breakMinutes;
    }
  }
  return result;
}
