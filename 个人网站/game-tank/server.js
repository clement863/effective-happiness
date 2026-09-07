// server.js —— 零依赖静态服务器（用于本地预览 ES Module）
// 运行：node server.js  （或直接双击 start.bat）
// 默认端口 8000，可用环境变量 PORT 覆盖

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8000;
const DEFAULT_PAGE = '/index.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  // 去掉查询参数并解码（支持中文文件名）
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = DEFAULT_PAGE;

  const filePath = path.join(ROOT, urlPath);

  // 防目录穿越：确保解析后的路径仍在 ROOT 内
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  ========================================');
  console.log('   科技坦克大战 · 本地预览服务已启动');
  console.log('   http://localhost:' + PORT + '/');
  console.log('   （默认打开 index.html 游戏入口）');
  console.log('   按 Ctrl+C 停止服务');
  console.log('  ========================================');
  console.log('');
});