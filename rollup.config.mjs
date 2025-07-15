import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import { readFileSync } from "fs";
import terser from "@rollup/plugin-terser";

const pkg = JSON.parse(readFileSync("./package.json", { encoding: "utf8" }));

export default [
	{
		input: "src/index.ts",
		output: {
			file: `dist/cjs/index.js`,
			format: "cjs",
			sourcemap: false,
		},
		plugins: [
			resolve(),
			commonjs(),
			json(),
			typescript({ tsconfig: "./tsconfig.json", declaration: false }),
			terser({
				compress: {
					drop_console: true,
				},
			}),
		],
	},
	{
		input: "src/index.ts",
		output: {
			file: `dist/esm/index.js`,
			format: "esm",
			sourcemap: false,
		},
		plugins: [
			resolve(),
			commonjs(),
			json(),
			typescript({
				tsconfig: "./tsconfig.json",
				declaration: true,
				declarationDir: "dist/esm",
			}),
			terser({
				compress: {
					drop_console: true,
				},
			}),
		],
	},
	{
		input: "dist/esm/index.d.ts",
		output: [{ file: "dist/index.d.ts", format: "es" }],
		plugins: [dts()],
	},
];
