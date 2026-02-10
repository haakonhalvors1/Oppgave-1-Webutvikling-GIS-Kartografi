import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 4173,
    host: true,
    proxy: {
      "/nvdb": {
        target: "https://nvdbapiles-v3.atlas.vegvesen.no",
        changeOrigin: true,
        secure: true,
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        rewrite: (path) => path.replace(/^\/nvdb/, "")
      }
    }
  }
});
