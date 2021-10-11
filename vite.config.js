const path = require('path');
const { defineConfig } = require('vite');
import typescript from "@rollup/plugin-typescript";

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/Shadertoy.ts'),
      formats: ['es'],
      fileName: () => 'ShadertoyWebGPU.js',
      name: 'ShadertoyWebGPU'
    },
    rollupOptions: {
      input: 'lib/Shadertoy.ts',
      output: {
        dir: 'dist',
      },
      plugins: [
        typescript({
          declaration: true,
          declarationDir: path.resolve(__dirname, 'dist'),
          exclude: [ path.resolve(__dirname, 'node_modules/**'), path.resolve(__dirname, 'src') ],
        })
      ]
    }
  },

})
