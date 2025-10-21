const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const srcDir = './src';
const clients = new Set();

// Dev temp dir im OS-Temp
const tmpDir = isDev ? path.join(os.tmpdir(), '3d-portfolio-tmp') : './dist';
if (isDev && !fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// Hot Reload
function notifyReload() {
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send('reload');
    }
}

// HTML kopieren (nur für Build)
function copyHtmlFiles(outputDir) {
    const htmlFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));
    htmlFiles.forEach(file => {
        let content = fs.readFileSync(path.join(srcDir, file), 'utf-8');

        // Link JS automatisch einfügen
        const name = path.basename(file, '.html');
        const jsFile = `${name}.js`;
        if (fs.existsSync(path.join(tmpDir, jsFile)) || !isDev) {
            content = content.replace(
                /<\/body>/,
                `<script src="./${jsFile}"></script>
</body>`
            );
        }

        fs.writeFileSync(path.join(outputDir, file), content, 'utf-8');
    });
}

// ---------------- Dev/Build ----------------
async function run() {
    const entryPoints = fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => path.join(srcDir, f));

    if (isDev) {
        let memoryBundles = {};

        async function buildMemory() {
            memoryBundles = {};
            for (const entry of entryPoints) {
                const result = await esbuild.build({
                    entryPoints: [entry],
                    bundle: true,
                    write: true,             // notwendig, sonst Sass-Plugin Fehler
                    outdir: tmpDir,
                    sourcemap: true,
                    plugins: [sassPlugin()],
                    loader: { '.ts': 'ts', '.scss': 'css' },
                });

                for (const output of result.outputFiles || []) {
                    const key = path.basename(output.path);
                    memoryBundles[key] = output.contents;
                }
            }
        }

        await buildMemory();
        console.log(`✅ Dev build complete (in Memory, tempDir=${tmpDir})`);

        // Watcher
        fs.watch(srcDir, { recursive: true }, async (eventType, filename) => {
            if (!filename) return;
            if (filename.endsWith('.ts') || filename.endsWith('.scss') || filename.endsWith('.html')) {
                await buildMemory();
                notifyReload();
                console.log(`🔁 File changed: ${filename}`);
            }
        });

        const server = http.createServer((req, res) => {
            let url = req.url === '/' ? '/index.html' : req.url;

            if (url.endsWith('.js') || url.endsWith('.css')) {
                const filePath = path.join(tmpDir, path.basename(url));
                fs.readFile(filePath, (err, data) => {
                    if (err) { res.writeHead(404); res.end('Not Found'); return; }
                    res.end(data);
                });
            } else {
                const filePath = path.join(srcDir, url);
                fs.readFile(filePath, (err, data) => {
                    if (err) { res.writeHead(404); res.end('Not Found'); return; }
                    res.end(data);
                });
            }
        });

        const wss = new WebSocket.Server({ server });
        wss.on('connection', ws => clients.add(ws));

        server.listen(8080, () => console.log('✅ Dev server running at http://localhost:8080'));

    } else {
        // Production Build -> dist/
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        await esbuild.build({
            entryPoints,
            bundle: true,
            outdir: tmpDir,
            sourcemap: true,
            plugins: [sassPlugin()],
            loader: { '.ts': 'ts', '.scss': 'css' },
        });

        copyHtmlFiles(tmpDir);
        console.log('✅ Production build complete -> dist/');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
