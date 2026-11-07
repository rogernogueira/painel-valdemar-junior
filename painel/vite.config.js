import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// UF do pacote servido no `npm run dev` e montado no `npm run build`
const uf = process.env.UF || "to";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // em desenvolvimento, o pacote de dados (data/, sql/, metadata/) é servido como público
  publicDir: `../dados/paineis/${uf}`,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/app[extname]",
      },
    },
  },
});
