const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const sassPlugin = require('esbuild-sass-plugin').default;

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
}).then(() => {
    console.log('Build completed!');

    // Kopiere die HTML-Datei in das dist-Verzeichnis
    fs.copyFileSync(path.resolve(__dirname, 'public/index.html'), path.resolve(__dirname, 'dist/index.html'));
    console.log('HTML-Datei in dist/ kopiert');
}).catch((error) => {
    console.error(error);
    process.exit(1);
});