import { LEVELS, type Level } from './record';

const CONFIG_SPLIT = /[\s,]+/;
const PART_SPLIT = /[\s|]+/;

export interface Rules {
  includes: Array<{ name: RegExp; level: Level }>;
  excludes: RegExp[];
}

function bounded(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/\*/g, '.*?')}$`);
}

/**
 * Parse the filter grammar: comma-separated `name|level` rules with `*`
 * wildcards and `-name` excludes. A bare level name (`info`) means `*|info`;
 * a bare name means `name|error`.
 */
export function parseRules(config: string | string[]): Rules {
  const list = Array.isArray(config) ? config : config.split(CONFIG_SPLIT);
  const rules: Rules = { includes: [], excludes: [] };

  for (const entry of list) {
    if (!entry) {
      continue;
    }
    if (entry.startsWith('-')) {
      if (entry.includes('|')) {
        throw new Error('Exclude rules should not include level');
      }
      rules.excludes.push(bounded(entry.substring(1)));
      continue;
    }

    const parts = entry.split(PART_SPLIT);
    let name = parts[0] ?? '*';
    let level = parts[1];

    // A bare level name (e.g. "info") is shorthand for "*|info".
    if (!level && LEVELS.includes(name as Level)) {
      level = name;
      name = '*';
    }
    level ??= 'error';

    if (!LEVELS.includes(level as Level)) {
      throw new Error(`Invalid level ${level}`);
    }
    rules.includes.push({ name: bounded(name), level: level as Level });
  }

  return rules;
}

/** Memoized name+level filter check against parsed rules. */
export function makeMatcher(rules: Rules): (level: Level, name: string) => boolean {
  const memo = new Map<string, boolean>();
  return (level, name) => {
    const key = `${level}|${name}`;
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let enabled = true;
    for (const exclude of rules.excludes) {
      // Excludes ignore level.
      if (exclude.test(name)) {
        enabled = false;
        break;
      }
    }

    if (enabled) {
      const levelIndex = LEVELS.indexOf(level);
      enabled = rules.includes.some(
        (include) => levelIndex >= LEVELS.indexOf(include.level) && include.name.test(name)
      );
    }

    memo.set(key, enabled);
    return enabled;
  };
}
