import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt", not "autoUpdate": a new build waits instead of activating
      // under the user's feet. The tracker holds unsaved state — a half-typed
      // task, a dialog mid-edit, an outbox still draining — and a reload the
      // user did not ask for would throw it away. UpdateToast offers it.
      registerType: "prompt",
      // UpdateToast registers the worker itself through
      // `virtual:pwa-register/react`, so the plugin must not also emit and
      // inject its own registerSW.js — that would be a second registration,
      // and an orphaned file in the precache when it is only left emitted.
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Bundle the Workbox runtime into sw.js instead of a second file.
        // Split, it is pulled in by an AMD `define()` shim that calls
        // importScripts() from inside a promise — i.e. after the worker has
        // finished evaluating — and Chrome refuses: "importScripts() of new
        // scripts after service worker installation is not allowed". The
        // worker then dies on activation and every navigation goes to the
        // network, which offline means the dinosaur. Firefox allows the late
        // import, so this looks browser-specific until you read the error.
        inlineWorkboxRuntime: true,
        runtimeCaching: [
          {
            // Avatars, and nothing else from Supabase. A service-worker cache
            // is keyed by URL, shared by everyone who uses the device and
            // outlives sign-out, so /rest/v1 and /auth/v1 must never be cached
            // here: that would leave one account's rows and tokens on disk for
            // the next person to sign in. Objects under /object/public/ are
            // world-readable by design, which is what makes them cacheable.
            urlPattern:
              /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i,
            // CacheFirst, not StaleWhileRevalidate: uploadAvatar() writes to a
            // fresh uuid every time, so the bytes behind a URL never change
            // and revalidating costs a request per render for nothing. A
            // replaced avatar arrives as a different URL.
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-avatars",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              // 200 only — not 0. An opaque response is what a no-cors <img>
              // gets, and its status is unreadable, so a 403 or 404 would
              // cache as if it were the image. ProfileAvatar asks for these
              // with crossOrigin="anonymous" to keep them readable; drop that
              // and avatars stop being cached at all.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "favicon-96x96.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "Cadence",
        short_name: "Cadence",
        description:
          "A calm habit tracker for the things you repeat: habits you log through the day, dailies that follow a schedule, and to-dos you finish once.",
        lang: "en",
        categories: ["productivity", "lifestyle"],
        start_url: "/",
        scope: "/",
        display: "standalone",
        // sRGB of --background in the light theme, oklch(0.9846 0.0034 286.15).
        // A manifest cannot read a CSS token, so these are copies — change them
        // alongside the token in src/index.css. See docs/design_system.md.
        theme_color: "#fafafc",
        background_color: "#fafafc",
        icons: [
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          // Separate entries, not `purpose: "any maskable"` on the pair above.
          // A maskable icon is cropped to the centre 80%, so the art is inset
          // and the tile bled to the edges — declaring one file as both would
          // mean either transparent corners under a square mask or a logo
          // shrunk for no reason everywhere else.
          {
            src: "/maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
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
