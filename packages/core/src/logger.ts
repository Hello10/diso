// Tiny zero-dependency debug logger. Silent by default; enable with
// `logger.enable()` or by setting DEBUG=groutcho in a Node environment.

let enabled = false;
try {
  const debug = typeof process !== 'undefined' ? process.env?.DEBUG : undefined;
  enabled = !!debug && /(^|,|\s)groutcho(,|\s|$|:|\*)/.test(debug);
} catch {
  enabled = false;
}

export const logger = {
  enable(on = true): void {
    enabled = on;
  },
  get enabled(): boolean {
    return enabled;
  },
  debug(...args: unknown[]): void {
    if (enabled) console.debug('[groutcho]', ...args);
  },
  info(...args: unknown[]): void {
    if (enabled) console.info('[groutcho]', ...args);
  },
  warn(...args: unknown[]): void {
    if (enabled) console.warn('[groutcho]', ...args);
  },
  error(...args: unknown[]): void {
    if (enabled) console.error('[groutcho]', ...args);
  }
};

export default logger;
