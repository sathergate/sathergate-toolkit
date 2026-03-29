/** A flag value can be a boolean, string, or number. */
export type FlagValue = boolean | string | number;

/** Context passed to flag evaluation for targeting and rollouts. */
export type FlagContext = Record<string, string | number | boolean>;

/** A rule that determines a flag's value based on conditions. */
export interface FlagRule<T extends FlagValue = FlagValue> {
  /** The value to return if this rule matches. */
  value: T;
  /** Percentage rollout (0-100). Requires context.userId for deterministic hashing. */
  percentage?: number;
  /** Key-value targeting. All keys must match the context for the rule to apply. */
  match?: Record<string, string | number | boolean>;
}

/** Definition for a single feature flag. */
export interface FlagDefinition<T extends FlagValue = FlagValue> {
  /** The default value when no rules match. */
  defaultValue: T;
  /** Human-readable description of the flag. */
  description?: string;
  /** Ordered list of rules. First matching rule wins. */
  rules?: FlagRule<T>[];
}

/** A record of flag definitions keyed by flag name. */
export type FlagDefinitions = Record<string, FlagDefinition<any>>;

/** Configuration for creating a flagpost instance. */
export interface FlagConfig<T extends FlagDefinitions = FlagDefinitions> {
  /** Flag definitions. */
  flags: T;
  /** Optional async function that resolves evaluation context. */
  context?: () => FlagContext | Promise<FlagContext>;
}

/** The evaluated value type for a single flag definition. */
export type FlagValueOf<D> = D extends FlagDefinition<infer T> ? T : never;

/** Extract a record of flag name to evaluated value type from definitions. */
export type ExtractFlags<T extends FlagDefinitions> = {
  [K in keyof T]: FlagValueOf<T[K]>;
};

/** Extract flag names as a union type. */
export type ExtractFlagNames<T extends FlagDefinitions> = keyof T & string;

/** The flagpost instance returned by createFlagpost. */
export interface Flagpost<T extends FlagDefinitions = FlagDefinitions> {
  /** Evaluate a single flag. */
  evaluate<K extends ExtractFlagNames<T>>(
    flagName: K,
    context?: FlagContext,
  ): ExtractFlags<T>[K];

  /** Evaluate all flags. */
  evaluateAll(context?: FlagContext): ExtractFlags<T>;

  /** Shorthand for boolean flags. Returns true if the flag evaluates to true. */
  isEnabled(flagName: ExtractFlagNames<T>, context?: FlagContext): boolean;

  /** The flag definitions. */
  readonly definitions: T;

  /** Resolve context using the configured context resolver. */
  resolveContext(): Promise<FlagContext>;
}
