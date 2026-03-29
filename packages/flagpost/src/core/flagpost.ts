import type {
  FlagConfig,
  FlagContext,
  FlagDefinitions,
  FlagRule,
  FlagValue,
  Flagpost,
  ExtractFlags,
  ExtractFlagNames,
} from "./types.js";

/**
 * Deterministic hash of a string to a number in [0, 100).
 * Uses a simple FNV-1a-inspired hash. No crypto dependency.
 */
function hashPercentage(userId: string, flagName: string): number {
  const input = `${userId}:${flagName}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned 32-bit and map to 0-99
  return ((hash >>> 0) % 10000) / 100;
}

/**
 * Check whether a single rule matches the given context.
 */
function ruleMatches<T extends FlagValue>(
  rule: FlagRule<T>,
  context: FlagContext,
  flagName: string,
): boolean {
  // Check match targeting first
  if (rule.match) {
    for (const [key, expected] of Object.entries(rule.match)) {
      if (context[key] !== expected) {
        return false;
      }
    }
  }

  // Check percentage rollout
  if (rule.percentage !== undefined) {
    const userId = context.userId;
    if (userId === undefined) {
      return false;
    }
    const bucket = hashPercentage(String(userId), flagName);
    if (bucket >= rule.percentage) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate a single flag definition against a context.
 */
function evaluateFlag<T extends FlagValue>(
  flagName: string,
  definition: { defaultValue: T; rules?: FlagRule<T>[] },
  context: FlagContext,
): T {
  if (definition.rules) {
    for (const rule of definition.rules) {
      if (ruleMatches(rule, context, flagName)) {
        return rule.value;
      }
    }
  }
  return definition.defaultValue;
}

/**
 * Create a flagpost instance for evaluating feature flags.
 *
 * @example
 * ```ts
 * const fp = createFlagpost({
 *   flags: {
 *     darkMode: { defaultValue: false },
 *     heroVariant: { defaultValue: "control", rules: [
 *       { value: "experiment", percentage: 50 }
 *     ]},
 *   },
 * });
 *
 * fp.isEnabled("darkMode"); // false
 * fp.evaluate("heroVariant", { userId: "user-123" }); // "control" or "experiment"
 * ```
 */
export function createFlagpost<T extends FlagDefinitions>(
  config: FlagConfig<T>,
): Flagpost<T> {
  const { flags, context: contextResolver } = config;

  const resolveContext = async (): Promise<FlagContext> => {
    if (contextResolver) {
      return contextResolver();
    }
    return {};
  };

  const evaluate = <K extends ExtractFlagNames<T>>(
    flagName: K,
    context: FlagContext = {},
  ): ExtractFlags<T>[K] => {
    const definition = flags[flagName];
    if (!definition) {
      throw new Error(`Flag "${flagName}" is not defined.`);
    }
    return evaluateFlag(flagName, definition, context) as ExtractFlags<T>[K];
  };

  const evaluateAll = (context: FlagContext = {}): ExtractFlags<T> => {
    const result: Record<string, FlagValue> = {};
    for (const [name, definition] of Object.entries(flags)) {
      result[name] = evaluateFlag(name, definition, context);
    }
    return result as ExtractFlags<T>;
  };

  const isEnabled = (
    flagName: ExtractFlagNames<T>,
    context: FlagContext = {},
  ): boolean => {
    const value = evaluate(flagName, context);
    return value === true;
  };

  return {
    evaluate,
    evaluateAll,
    isEnabled,
    definitions: flags,
    resolveContext,
  };
}
