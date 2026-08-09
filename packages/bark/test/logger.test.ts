import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Bark, { type BarkRecord, LEVELS } from "../src/index";

describe("Bark scopes and logging", () => {
	let records: BarkRecord[];

	beforeEach(() => {
		records = [];
		Bark.reset();
		Bark.configure({
			level: "*|trace",
			sink: (record) => records.push(record),
			time: () => "T",
		});
	});

	afterEach(() => {
		Bark.reset();
	});

	describe("level methods", () => {
		for (const level of LEVELS) {
			it(`.${level} emits a record with context fields`, () => {
				const bark = new Bark("fucky");
				bark.set({ hello: 10 });
				bark[level]("hi");
				expect(records).toHaveLength(1);
				const record = records[0]!;
				expect(record.level).toBe(level);
				expect(record.name).toBe("fucky");
				expect(record.message).toBe("hi");
				expect(record.fields.hello).toBe(10);
				expect(record.time).toBe("T");
				expect(record.traceId).toBeTruthy();
			});
		}

		it(".log is an alias for info", () => {
			const bark = new Bark("a");
			bark.log("via alias");
			expect(records[0]!.level).toBe("info");
			expect(records[0]!.message).toBe("via alias");
		});

		it("accepts (message, fields)", () => {
			new Bark("a").info("msg", { count: 3 });
			expect(records[0]!.fields.count).toBe(3);
		});

		it("accepts (error, fields) — kind error, serialized payload", () => {
			new Bark("a").error(new Error("Honk"), { action: "checkout" });
			const record = records[0]!;
			expect(record.kind).toBe("error");
			expect(record.message).toBe("Honk");
			expect(record.fields.action).toBe("checkout");
			expect(
				(record.fields.error as { fingerprint: string }).fingerprint,
			).toBeTruthy();
		});
	});

	describe("branch", () => {
		it('joins names with ":" and merges fields, sharing the context', () => {
			const bark = Bark.start({ app: "shop" });
			const cbark = bark.branch("checkout", { cart: "c1" });
			cbark.log("start checkout");

			const record = records.at(-1)!;
			expect(record.name).toBe("app:checkout");
			expect(record.fields.cart).toBe("c1");
			expect(record.fields.app).toBe("shop");
			expect(record.traceId).toBe(bark.traceId);

			// set() on the parent is visible to the branch (shared context)
			bark.set({ userId: "u1" });
			cbark.log("later");
			expect(records.at(-1)!.fields.userId).toBe("u1");
		});

		it("branches nest", () => {
			const bark = Bark.start();
			const inner = bark.branch("a").branch("b");
			inner.log("x");
			expect(records.at(-1)!.name).toBe("app:a:b");
		});
	});

	describe("filtering", () => {
		it("applies level thresholds", () => {
			Bark.configure({ level: "*|warn" });
			const bark = new Bark("quiet");
			bark.info("nope");
			bark.warn("yep");
			expect(records).toHaveLength(1);
			expect(records[0]!.message).toBe("yep");
		});

		it("filters by name including excludes", () => {
			Bark.configure({ level: "*|trace,-noisy*" });
			new Bark("noisy:thing").fatal("nope");
			new Bark("fine").info("yep");
			expect(records).toHaveLength(1);
			expect(records[0]!.name).toBe("fine");
		});

		it("silences timing records selectively via -timing:*", () => {
			Bark.configure({ level: "*|trace,-timing:*" });
			const bark = Bark.start();
			bark.span("db").end();
			bark.info("still here");
			expect(records).toHaveLength(1);
			expect(records[0]!.message).toBe("still here");
		});
	});

	describe("formats", () => {
		it("json format emits a single parseable line", () => {
			const lines: unknown[][] = [];
			Bark.configure({
				format: "json",
				sink: (_record, formatted) => lines.push(formatted),
			});
			new Bark("api").info("hello", { n: 1 });
			expect(lines[0]).toHaveLength(1);
			const parsed = JSON.parse(lines[0]![0] as string) as BarkRecord;
			expect(parsed.name).toBe("api");
			expect(parsed.fields.n).toBe(1);
		});
	});
});
