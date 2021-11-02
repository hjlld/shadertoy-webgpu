import path from 'path';
import { defineConfig } from 'vite';
import typescript from "@rollup/plugin-typescript";
import resolve from '@rollup/plugin-node-resolve';

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/Shadertoy.ts'),
      formats: ['es'],
      fileName: () => 'Shadertoy.js',
    },
    rollupOptions: {
      input: 'lib/Shadertoy.ts',
      output: {
        dir: 'dist',
      },
      plugins: [
        resolve({
          moduleDirectories: ['node_modules']
        }),
        typescript({
          declaration: true,
          declarationDir: path.resolve(__dirname, 'dist'),
          exclude: [ 'node_modules', 'src' ]
        })
      ],
      external: [ "@webgpu/glslang/dist/web-devel-onefile/glslang" ]
    }
  },

})
