import nextJest from "next/jest";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/.next/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/**/page.tsx",
    "!src/app/**/layout.tsx",
  ],
  coverageThreshold: {
    global: {
      lines: 50,
      statements: 50,
      functions: 40,
      branches: 35,
    },
  },
};

export default createJestConfig(customJestConfig);
