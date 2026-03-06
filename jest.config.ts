import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: false,
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "node",
          verbatimModuleSyntax: false,
          allowImportingTsExtensions: false,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  setupFiles: ["<rootDir>/tests/setup.ts"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
};

export default config;
