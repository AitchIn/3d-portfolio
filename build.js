const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const outdir = './dist';
const srcDir = './src';

// Helper: alle HTML-Dateien kopieren
function copyHtmlFiles() {
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
    files.forEach(file => {
        fs.copyFileSync(path.join(srcDir, file), path.join(outdir, file));
    });
}

// Hot Reload
const clients = new Set();
function notifyReload() {
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send('reload');
    }
}

// Build / Watch
async function buildAndWatch() {
    // 1️⃣ Initial copy HTML
    copyHtmlFiles();

    // 2️⃣ Esbuild context für TS + SCSS
    const ctx = await esbuild.context({
        entryPoints: fs.readdirSync(srcDir)
            .filter(f => f.endsWith('.ts'))
            .map(f => path.join(srcDir, f)),
        bundle: true,
        outdir,
        sourcemap: true,
        plugins: [sassPlugin()],
        loader: {
            '.ts': 'ts',
            '.scss': 'css',
            '.html': 'copy'
        },
    });

    // 3️⃣ Erstes Build
    await ctx.rebuild();
    console.log('✅ Initial build complete');

    // 4️⃣ Watch starten
    await ctx.watch();
    console.log('👀 Watching for changes...');

    // 5️⃣ Watcher für HTML-Dateien
    fs.watch(srcDir, (event, filename) => {
        if (filename.endsWith('.html')) {
            copyHtmlFiles();
            notifyReload();
            console.log(`🔁 HTML updated: ${filename}`);
        }
    });

    // 6️⃣ HTTP Server
    const server = http.createServer((req, res) => {
        const url = req.url === '/' ? '/index.html' : req.url;
        const filePath = path.join(outdir, url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.end(data);
            }
        });
    });

    const wss = new WebSocket.Server({ server });
    wss.on('connection', ws => clients.add(ws));

    server.listen(8080, () => console.log('✅ Dev server running at http://localhost:8080'));
}

buildAndWatch().catch(err => {
    console.error(err);
    process.exit(1);
});
