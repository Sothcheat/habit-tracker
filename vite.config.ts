import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries every page needs, in their own long-lived files: they
        // change far less often than the app, so a redeploy of app code
        // leaves them cached. UI libraries are deliberately NOT grouped —
        // the login page would then download the tracker's dialogs and menus;
        // left alone, they split per page along the lazy routes in App.tsx.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              priority: 20,
            },
            {
              name: "supabase",
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
