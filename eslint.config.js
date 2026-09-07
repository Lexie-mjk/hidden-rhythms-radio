// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Fonctions Deno (Supabase Edge Functions) : runtime et conventions différentes, pas de projet TS partagé.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
