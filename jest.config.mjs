export default {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results",
        outputName: "jest-junit.xml",
        classNameTemplate: "{filename}",
        titleTemplate: "{title}",
      },
    ],
  ],
};
