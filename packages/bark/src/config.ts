import { makeMatcher, parseRules } from "./matcher";
import type { BarkRecord, Formatter, Level, Sink } from "./record";

/** Pretty formatter: readable in browser devtools and `wrangler dev`. */
export const pretty: Formatter = (record) => {
	const parts: unknown[] = [];
	if (record.message !== undefined) {
		parts.push(record.message);
	}
	parts.push({
		...record.fields,
		name: record.name,
		time: record.time,
		...(record.traceId ? { traceId: record.traceId } : {}),
	});
	return parts;
};

/** JSON-lines formatter: one line per record, for Workers Logs / Logpush. */
export const json: Formatter = (record) => [JSON.stringify(record)];

const CONSOLE_FN: Record<Level, "trace" | "debug" | "info" | "warn" | "error"> =
	{
		trace: "trace",
		debug: "debug",
		info: "info",
		warn: "warn",
		error: "error",
		fatal: "error", // console has no fatal
	};

/** Default sink: write to the appropriate console method. */
export const consoleSink: Sink = (record, formatted) => {
	console[CONSOLE_FN[record.level]](...formatted);
};

export interface BarkConfig {
	/** Filter grammar (`name|level`, `*`, `-name`) — or a bare level like `'info'`. */
	level?: string | string[];
	/** `'pretty'` (default), `'json'`, or a custom formatter. */
	format?: "pretty" | "json" | Formatter;
	/** Where formatted records go. Default: console. */
	sink?: Sink;
	/** Master switch for timing collection (observers + spans). Default on. */
	timing?: boolean;
	/** Value for Timing-Allow-Origin on finish() responses (e.g. '*'). */
	timingAllowOrigin?: string;
	/** Override the timestamp source (testing). */
	time?: () => string;
}

interface Resolved {
	enabled: (level: Level, name: string) => boolean;
	formatter: Formatter;
	sink: Sink;
	timing: boolean;
	timingAllowOrigin?: string;
	time: () => string;
}

let explicit: BarkConfig = {};
let resolved: Resolved | null = null;

function resolveLevel(): string | string[] {
	if (explicit.level !== undefined) {
		return explicit.level;
	}
	// Explicit-first, then environment, then everything-at-error.
	if (typeof process !== "undefined") {
		const env = process.env?.LOGGER;
		if (env) {
			return env;
		}
	}
	const ls = (globalThis as { localStorage?: Record<string, string> })
		.localStorage;
	if (ls?.LOGGER) {
		return ls.LOGGER;
	}
	return "*";
}

function resolve(): Resolved {
	if (resolved) {
		return resolved;
	}
	const {
		format = "pretty",
		sink = consoleSink,
		timing = true,
		timingAllowOrigin,
		time,
	} = explicit;
	const formatter =
		typeof format === "function" ? format : format === "json" ? json : pretty;
	resolved = {
		enabled: makeMatcher(parseRules(resolveLevel())),
		formatter,
		sink,
		timing,
		timingAllowOrigin,
		time: time ?? (() => new Date().toISOString()),
	};
	return resolved;
}

/** Set global config (call once at app init). Merges over previous calls. */
export function configure(config: BarkConfig): void {
	explicit = { ...explicit, ...config };
	resolved = null; // lazily re-resolved (and matcher memo reset) on next use
}

/** Reset all config to defaults (primarily for tests). */
export function resetConfig(): void {
	explicit = {};
	resolved = null;
}

export function getConfig(): Resolved {
	return resolve();
}

/** Emit a record through the configured filter, formatter, and sink. */
export function emit(record: BarkRecord): void {
	const config = resolve();
	if (!config.enabled(record.level, record.name)) {
		return;
	}
	config.sink(record, config.formatter(record));
}
