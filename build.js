import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const livereload = require('livereload'); // ✅ funktioniert mit CommonJS
import esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import httpServer from 'http-server';

// 1️⃣ Livereload Server starten
const liveReloadServer = livereload.createServer();
liveReloadServer.watch('./dist');

// 2️⃣ Esbuild Setup
const context = await esbuild.context({
    entryPoints: ['./src/index.ts'],
    bundle: true,
    outdir: './dist',
    minify: false,
    sourcemap: true,
    plugins: [sassPlugin()],
});

// 3️⃣ Watch aktivieren
await context.watch();

// 4️⃣ HTTP Server starten
const server = httpServer.createServer({ root: './dist' });
server.listen(8080, () => {
    console.log('Server running at http://localhost:8080');
    console.log('Watching for changes with LiveReload...');
});
