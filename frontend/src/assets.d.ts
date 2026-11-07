// assets.d.ts — module declarations for the report artifacts the pages import.
//
// Vite turns an SVG import into its public URL, so every chart under
// src/assets can be used as an <img src>. The shapes below exist only for
// TypeScript, which would otherwise treat the import as an untyped module.

declare module '*.svg' {
  const src: string;
  export default src;
}

