import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		environment: "happy-dom",
	},
	pack: {
		entry: ["src/index.ts"],
		format: ["esm"],
		dts: { generator: "tsgo" },
		sourcemap: true,
		target: "es2022",
		// Keep dist/index.js and dist/index.d.ts, which package.json exports.
		fixedExtension: false,
		external: ["react", "react-dom", "react/jsx-runtime", "@diso.io/groutcho"],
	},
});
