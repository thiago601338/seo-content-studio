import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Prioriza os arquivos TypeScript da versao 3.x caso o repositorio
  // ainda contenha arquivos .jsx/.js remanescentes de versoes antigas.
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.mts', '.json'],
  },
  build: { sourcemap: true },
});
