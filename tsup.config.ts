import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs', 'iife'],
    dts: true,
    outDir: 'dist',
    globalName: 'SupportSDK',
    outExtension({ format }) {
      if (format === 'esm') return { js: '.mjs' };
      if (format === 'cjs') return { js: '.cjs' };
      if (format === 'iife') return { js: '.global.js' };
      return { js: '.js' };
    },
    define: {
      __SDK_VERSION__: JSON.stringify(pkg.version),
    },
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/contract/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist/contract',
    outExtension({ format }) {
      if (format === 'esm') return { js: '.mjs' };
      if (format === 'cjs') return { js: '.cjs' };
      return { js: '.js' };
    },
    sourcemap: true,
  },
]);
