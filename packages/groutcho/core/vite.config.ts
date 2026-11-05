import { defineConfig } from "vite-plus";

export default defineConfig({
	pack: {
		entry: ["src/index.ts"],
		format: ["esm"],
		dts: { generator: "tsgo" },
		sourcemap: true,
		target: "es2022",
		// Keep dist/index.js and dist/index.d.ts, which package.json exports.
		fixedExtension: false,
	},
});
