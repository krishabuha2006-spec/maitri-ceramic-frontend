process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/dummy';
const app = require('../server');
const { swaggerDocument } = require('../config/swagger');

const expressRoutes = [];
app._router.stack.forEach(middleware => {
  if (middleware.name === 'router') {
    let base = '';
    if (middleware.regexp) {
      const match = middleware.regexp.source.match(/\\\/api\\\/([a-zA-Z0-9_\-]+)/);
      if (match) {
        base = '/api/' + match[1];
      }
    }
    middleware.handle.stack.forEach(handler => {
      if (handler.route) {
        Object.keys(handler.route.methods).forEach(method => {
          let p = base + (handler.route.path === '/' ? '' : handler.route.path);
          p = p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
          expressRoutes.push({ method: method.toLowerCase(), path: p });
        });
      }
    });
  }
});

console.log('Total Express Routes Found:', expressRoutes.length);
console.log('Total Swagger Paths Found:', Object.keys(swaggerDocument.paths).length);

const missingFromSwagger = [];
expressRoutes.forEach(r => {
  const swaggerPath = r.path.replace('/api', '');
  if (!swaggerDocument.paths[swaggerPath] || !swaggerDocument.paths[swaggerPath][r.method]) {
    missingFromSwagger.push(`${r.method.toUpperCase()} ${r.path} (Swagger path: ${swaggerPath})`);
  }
});

console.log('Missing from Swagger count:', missingFromSwagger.length);
if (missingFromSwagger.length > 0) {
  missingFromSwagger.forEach(m => console.log(' ->', m));
} else {
  console.log('🎉 ALL EXPRESS ROUTES ARE 100% FULLY DOCUMENTED IN SWAGGER!');
}

// Print summary by tag
const tagCounts = {};
for (const [path, methods] of Object.entries(swaggerDocument.paths)) {
  for (const [method, spec] of Object.entries(methods)) {
    const tag = spec.tags ? spec.tags[0] : 'Uncategorized';
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
}

console.log('\n--- Swagger Operations by Tag ---');
Object.entries(tagCounts).forEach(([tag, count]) => {
  console.log(`- ${tag}: ${count} operations`);
});

process.exit(0);
