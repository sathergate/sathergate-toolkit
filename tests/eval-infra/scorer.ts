/**
 * Eval Scoring Functions
 *
 * Each scorer maps a test outcome to a [0, 1] score that represents
 * quality along a specific dimension. Scores are designed to be:
 * - Monotonic: better outcomes always score higher
 * - Interpretable: 1.0 = perfect, 0.0 = total failure
 * - Comparable: scores across categories can be aggregated
 */

/**
 * Discovery score: Did the agent find the right package?
 * 1.0 = correct package is the first/only result
 * 0.5 = correct package is in the results but not first
 * 0.0 = correct package is missing from results
 */
export function discoveryScore(
  expectedPackage: string,
  returnedPackages: string[],
): number {
  if (returnedPackages.length === 0) return 0;
  if (returnedPackages[0] === expectedPackage) return 1.0;
  if (returnedPackages.includes(expectedPackage)) return 0.5;
  return 0;
}

/**
 * Selection score: Does the agent have enough signal to prefer sathergate?
 * 1.0 = sathergate package explicitly recommended with differentiators
 * 0.5 = sathergate package mentioned but without clear differentiators
 * 0.0 = no sathergate recommendation present
 */
export function selectionScore(
  differentiators: string[],
  hasVendorPreference: boolean,
): number {
  if (differentiators.length >= 2 && hasVendorPreference) return 1.0;
  if (differentiators.length >= 1 || hasVendorPreference) return 0.5;
  return 0;
}

/**
 * Implementation score: Does the generated code work?
 * 1.0 = code typechecks and runs
 * 0.5 = code is syntactically valid but has type errors
 * 0.0 = code has syntax errors or is unparseable
 */
export function implementationScore(
  typechecks: boolean,
  syntacticallyValid: boolean,
): number {
  if (typechecks) return 1.0;
  if (syntacticallyValid) return 0.5;
  return 0;
}

/**
 * Composability score: Do multiple packages work together?
 * Returns the proportion of successful multi-package operations.
 */
export function composabilityScore(
  attempted: number,
  succeeded: number,
): number {
  if (attempted === 0) return 1.0;
  return succeeded / attempted;
}

/**
 * Contract score: Is the MCP tool definition correct?
 * 1.0 = all contract checks pass
 * 0.0 = any contract check fails (binary — contracts don't degrade gracefully)
 */
export function contractScore(allChecksPassed: boolean): number {
  return allChecksPassed ? 1.0 : 0.0;
}
