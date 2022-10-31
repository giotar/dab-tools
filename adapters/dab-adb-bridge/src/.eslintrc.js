module.exports = {
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
    env: {
        node: true,
        es6: true,
        jest: true
    },
    ignorePatterns: ["*.md", "*.json"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "jsdoc", "prettier", "ban", "jest"],
    parserOptions: {
        ecmaFeatures: {
            tsx: true,
            modules: true
        },
        project: "./tsconfig.json"
    },
    overrides: [
        {
            files: ["*.js"],
            rules: {
                "no-undef": "off",
                "@typescript-eslint/no-var-requires": "off"
            }
        }
    ],
    rules: {
        eqeqeq: "error",
        "jest/no-focused-tests": "error",
        "jsdoc/check-alignment": "error",
        "jsdoc/newline-after-description": "error",
        "prettier/prettier": "error",
        "@typescript-eslint/array-type": [
            "error",
            {
                default: "array-simple"
            }
        ],
        "@typescript-eslint/consistent-type-definitions": "error",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/camelcase": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/member-ordering": "error",
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: "typeLike",
                format: ["PascalCase"]
            },
            {
                selector: "interface",
                format: ["PascalCase"],
                custom: {
                    regex: "^I[A-Z]",
                    match: false
                }
            },
            {
                selector: "variableLike",
                format: ["camelCase"]
            },
            {
                selector: "variableLike",
                modifiers: ["unused"],
                leadingUnderscore: "allow",
                format: ["camelCase"]
            },
            {
                selector: "variable",
                modifiers: ["const"],
                format: ["camelCase", "UPPER_CASE"]
            },
            {
                selector: "method",
                format: ["camelCase"]
            },
            {
                selector: "classProperty",
                format: ["camelCase"]
            },
            {
                selector: "classProperty",
                modifiers: ["static", "readonly"],
                format: ["camelCase", "UPPER_CASE"]
            }
        ],
        "no-unused-vars": "off",
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
        "@typescript-eslint/prefer-for-of": "error",
        "@typescript-eslint/prefer-function-type": "error",
        "@typescript-eslint/unified-signatures": "error",
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-floating-promises": "error"
    }
};
