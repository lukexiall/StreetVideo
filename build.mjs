// Builds a single self-contained HTML page.
//   dist/streettree-studio.html  – page body for publishing as an Artifact
//   dist/index.html              – full standalone document (open locally)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  write: false,
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');

const head = `<title>StreetTree Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">
<style>${css}</style>`;
const body = `<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/streettree-studio.html', `${head}\n${body}\n`);
writeFileSync('dist/index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('Built dist/streettree-studio.html', Math.round((head.length + body.length) / 1024), 'KB');
