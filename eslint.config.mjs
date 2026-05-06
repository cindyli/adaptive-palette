import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [{
  ignores: ["**/dist/", "**/node_modules/", "**/*.d.ts", "**/*.cjs"],
}, ...compat.extends(
  "eslint:recommended",
  "plugin:@typescript-eslint/recommended",
  "plugin:@typescript-eslint/recommended-type-checked"
), {
  plugins: {
    "@typescript-eslint": typescriptEslint,
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: {
      project: "./tsconfig.eslint.json",
      tsconfigRootDir: __dirname,
    },
  },

  rules: {
    indent: ["error", 2],
    "linebreak-style": ["error", "unix"],
    quotes: ["error", "double"],
    semi: ["error", "always"],

    // Disable unsafe-* rules: these require fully typed code and are too noisy
    // for the existing JS codebase. Re-enable incrementally as types improve.
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
  },
},
// unbound-method is a false positive with Jest's expect(mock.fn) pattern
{
  files: ["**/*.test.ts", "**/*.test.js"],
  rules: {
    "@typescript-eslint/unbound-method": "off",
  },
}];
