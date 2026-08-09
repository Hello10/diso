import { emit, getConfig } from './config';
import type { Bark } from './Logger';

let installed = false;
let onError: ((event: ErrorEvent) => void) | null = null;
let onRejection: ((event: PromiseRejectionEvent) => void) | null = null;
let observer: PerformanceObserver | null = null;

interface ServerTimingEntry {
  name: string;
  duration: number;
  description: string;
}

interface TimedEntry extends PerformanceEntry {
  serverTiming?: ServerTimingEntry[];
  transferSize?: number;
}

/**
 * Browser-side passive capture, installed idempotently by the first
 * `Bark.start()`: a PerformanceObserver for navigation/resource entries (client
 * timing + any incoming Server-Timing metrics — the round-trip loop) and global
 * error handlers. No fetch patching, no wrapping.
 */
export function installCollectors(scope: Bark): void {
  if (installed) {
    return;
  }
  installed = true;

  const config = getConfig();

  if (config.timing && typeof PerformanceObserver !== 'undefined') {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as TimedEntry[]) {
        const server = (entry.serverTiming ?? []).map(({ name, duration, description }) => ({
          name,
          duration,
          description
        }));
        emit({
          kind: 'timing',
          level: 'debug',
          name: `timing:${entry.entryType}`,
          message: entry.name,
          time: getConfig().time(),
          traceId: scope.traceId,
          fields: {
            duration: Math.round(entry.duration),
            ...(server.length ? { server } : {})
          }
        });
      }
    });
    try {
      observer.observe({ type: 'navigation', buffered: true });
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      // Older engines without per-type observe; not worth failing startup over.
    }
  }

  onError = (event: ErrorEvent) => {
    scope.error(event.error instanceof Error ? event.error : new Error(String(event.message)));
  };
  onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    scope.error(reason instanceof Error ? reason : new Error(String(reason)));
  };
  addEventListener('error', onError);
  addEventListener('unhandledrejection', onRejection);
}

/** Uninstall collectors and reset state (tests only). */
export function resetCollectors(): void {
  if (installed) {
    if (onError) {
      removeEventListener('error', onError);
    }
    if (onRejection) {
      removeEventListener('unhandledrejection', onRejection);
    }
    observer?.disconnect();
  }
  installed = false;
  onError = null;
  onRejection = null;
  observer = null;
}
