/// <reference types="vitest" />
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// `npm run build`         -> multi-file static site (GitHub Pages, any static host)
// `npm run build:single`  -> one self-contained index.html (offline use, sharing, embedding)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const plugins: PluginOption[] = [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeSlug, [rehypeKatex, { strict: false }]],
        providerImportSource: '@mdx-js/react',
      }),
    },
    react({ include: /\.(mdx|tsx?|jsx?)$/ }),
  ];
  if (single) plugins.push(viteSingleFile());

  return {
    base: './',
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 4000,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
