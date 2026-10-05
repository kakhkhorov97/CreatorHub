const { cpSync, existsSync, readdirSync, rmSync } = require('node:fs');
const { resolve } = require('node:path');

const source = resolve(__dirname, '../public/demo-media');
const target = resolve(__dirname, '../dist/apps/Creator-api/public/demo-media');
if (!existsSync(source) || readdirSync(source).length === 0) {
	throw new Error('Backend demo media is missing from public/demo-media');
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Packaged ${readdirSync(target).length} demo media files with the API build.`);
