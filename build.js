const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// CLI Argumente
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const outDirIndex = args.indexOf('--outdir');
const outDir = outDirIndex !== -1 ? args[outDirIndex + 1] : './dist';
const srcDir = './src';
const clients = new Set();

function copyHtmlFiles(entryPoints) {
    const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
    htmlFiles.forEach(file => {
        const htmlPath = path.join(srcDir, file);
        let content = fs.readFileSync(htmlPath, 'utf-8');
        const name = path.basename(file, '.html');

        if (entryPoints.some(e => path.basename(e, '.ts') === name)) {
            content = content.replace(
                /<\/body>/,
                `<script src="./${name}.js"></script>
<script>
const ws = new WebSocket('ws://' + location.host);
ws.onmessage = (e) => { if(e.data==='reload') location.reload(); };
</script>
</body>`
            );
        }

        fs.writeFileSync(path.join(outDir, file), content, 'utf-8');
    });
}

function notifyReload() {
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send('reload');
    }
}

async function buildAndWatch() {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const entryPoints = fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => path.join(srcDir, f));

    const ctx = await esbuild.context({
        entryPoints,
        bundle: true,
        outdir: outDir,
        sourcemap: true,
        plugins: [sassPlugin()],
        loader: { '.ts': 'ts', '.scss': 'css' },
    });

    await ctx.rebuild();
    console.log(`✅ Initial build complete -> ${outDir}`);

    copyHtmlFiles(entryPoints);

    if (isWatch) {
        await ctx.watch();
        console.log('👀 Watching for changes...');

        fs.watch(srcDir, (event, filename) => {
            if (!filename) return;
            if (filename.endsWith('.html') || filename.endsWith('.ts') || filename.endsWith('.scss')) {
                copyHtmlFiles(entryPoints);
                notifyReload();
                console.log(`🔁 File updated: ${filename}`);
            }
        });

        const server = http.createServer((req, res) => {
            const url = req.url === '/' ? '/index.html' : req.url;
            const filePath = path.join(outDir, url);
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
}

buildAndWatch().catch(err => {
    console.error(err);
    process.exit(1);
});
