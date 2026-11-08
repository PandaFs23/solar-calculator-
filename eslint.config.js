import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",   // not needed with React 17+ JSX transform
      "no-unused-vars": ["warn", { varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // This app never adopted PropTypes — no component validates props, so the
      // recommended rule would flag ~180 pre-existing "missing" validations.
      "react/prop-types": "off",
      // The app writes apostrophes/quotes directly in JSX text (e.g. "don't",
      // 15' spacing). Mandating HTML entities adds noise for zero benefit here.
      "react/no-unescaped-entities": "off",
      // Two sites sync a derived "errors seen" ack through an effect. Keep the
      // rule visible as a warning (non-blocking, like no-unused-vars below)
      // until a proper rework removes the pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];
