import type { CodegenConfig } from "@graphql-codegen/cli";

// Types for every GraphQL query in the app, generated from the API's schema (exported by
// `uv run python -m scripts.export_schema` in api/). CI fails if src/graphql/generated is out of date.
const config: CodegenConfig = {
  schema: "src/graphql/schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/graphql/generated/**"],
  ignoreNoDocuments: true,
  generates: {
    "src/graphql/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        scalars: { DateTime: "string", Date: "string" },
        avoidOptionals: { field: true, inputValue: false, object: true },
      },
    },
  },
};

export default config;
