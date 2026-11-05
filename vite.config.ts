import { fmt, lint, staged } from "@hello10/config-vite-plus/base";
import { defineConfig } from "vite-plus";

export default defineConfig({
	staged,
	lint,
	fmt,
});
