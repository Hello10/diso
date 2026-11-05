import { defineConfig } from "vite-plus";

// lint, fmt, and staged match @hello10/config-vite-plus. Switch to importing
// them from that package once it is published.
export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		options: { typeAware: true, typeCheck: true },
		rules: {
			"vite-plus/prefer-vite-plus-imports": "error",
			"no-unused-vars": [
				"warn",
				{ args: "all", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortImports: {},
		sortPackageJson: false,
		ignorePatterns: ["**/*.md"],
	},
});
