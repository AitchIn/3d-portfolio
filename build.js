const esbuild = require('esbuild');
const sassPlugin = require('esbuild-sass-plugin').default;
const httpServer = require('http-server');
const path = require('path');

// Erstelle den Build im Watch-Modus
esbuild.build({
    entryPoints: ['./src/index.ts'],
    bundle: true,
    outdir: './dist',
    minify: true,
    sourcemap: true,
    plugins: [sassPlugin()],
    loader: {
        '.ts': 'ts',
        '.scss': 'text',
    },
    watch: {
        onRebuild(error, result) {
            if (error) {
                console.error('Build failed:', error);
            } else {
                console.log('Build succeeded:', result);
            }
        },
    },
}).then(() => {
    console.log('Watching for changes...');

    // Starte den HTTP-Server im dist/ Ordner
    const server = httpServer.createServer({ root: './dist' });
    server.listen(8080, () => {
        console.log('Server läuft auf http://localhost:8080');
    });
}).catch((error) => {
    console.error(error);
    process.exit(1);
});