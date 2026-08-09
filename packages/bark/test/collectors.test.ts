// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Bark, {
	type BarkRecord,
	resetCollectors,
	type Span,
	serverTimingHeader,
} from "../src/index";

describe("browser collectors (Bark.start in a document)", () => {
	let records: BarkRecord[];

	beforeEach(() => {
		records = [];
		Bark.reset();
		resetCollectors();
		Bark.configure({
			level: "*|trace",
			sink: (record) => records.push(record),
		});
	});

	afterEach(() => {
		Bark.reset();
		resetCollectors();
	});

	it("captures global errors as error records on the root scope", () => {
		const bark = Bark.start({ page: "/home" });
		window.dispatchEvent(
			new ErrorEvent("error", { error: new Error("boom"), message: "boom" }),
		);

		const record = records.find((entry) => entry.kind === "error")!;
		expect(record).toBeTruthy();
		expect(record.message).toBe("boom");
		expect(record.traceId).toBe(bark.traceId);
		expect(record.fields.page).toBe("/home");
		expect(
			(record.fields.error as { fingerprint: string }).fingerprint,
		).toBeTruthy();
	});

	it("captures unhandled rejections", () => {
		Bark.start();
		const event = new Event("unhandledrejection") as Event & {
			reason?: unknown;
		};
		event.reason = new Error("rejected");
		window.dispatchEvent(event);

		const record = records.find((entry) => entry.kind === "error")!;
		expect(record.message).toBe("rejected");
	});

	it("installs collectors only once across multiple starts", () => {
		Bark.start();
		Bark.start();
		window.dispatchEvent(
			new ErrorEvent("error", { error: new Error("once"), message: "once" }),
		);
		expect(records.filter((entry) => entry.kind === "error")).toHaveLength(1);
	});
});

describe("round-trip correlation (server spans -> Server-Timing -> client)", () => {
	// Minimal client-side parser matching what PerformanceServerTiming exposes.
	function parseServerTiming(
		header: string,
	): Array<{ name: string; dur: number; desc?: string }> {
		return header.split(",").map((part) => {
			const segments = part.trim().split(";");
			const out: { name: string; dur: number; desc?: string } = {
				name: segments[0]!,
				dur: 0,
			};
			for (const segment of segments.slice(1)) {
				const [key, raw] = segment.split("=") as [string, string];
				if (key === "dur") {
					out.dur = Number(raw);
				}
				if (key === "desc") {
					out.desc = raw.replace(/^"|"$/g, "");
				}
			}
			return out;
		});
	}

	it("spans survive the header round-trip with names and durations intact", () => {
		const spans: Span[] = [
			{ name: "db", start: 0, duration: 42, description: "primary" },
			{ name: "kv cache", start: 0, duration: 7 },
			{ name: "open", start: 0 }, // unfinished -> omitted
		];
		const header = serverTimingHeader(spans);
		const parsed = parseServerTiming(header);

		expect(parsed).toEqual([
			{ name: "db", dur: 42, desc: "primary" },
			{ name: "kv_cache", dur: 7 }, // token-sanitized
		]);
	});
});
