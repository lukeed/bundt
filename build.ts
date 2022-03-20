import * as fs from 'fs';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import * as pkg from './package.json';
import * as $ from './src/utils';

let commons: esbuild.CommonOptions = {
	charset: 'utf8',
	logLevel: 'warning',
	minifyIdentifiers: true,
	minifySyntax: true,
	target: 'es2020',
};

async function write(output: string, content: string) {
	let data = await $.minify(content).then(r => r.code);
	if (!data) return $.throws('Invalid terser output');

	await fs.promises.writeFile(output, data);
	console.log('~> write "%s" output~!', output);
}

console.log('---');

// index.js
await esbuild.build({
	...commons,
	write: false,
	entryPoints: ['src/index.ts'],
	charset: 'utf8',
	format: 'esm',
	bundle: true,
	external: [
		pkg.name,
		...builtinModules,
		...Object.keys(pkg.dependencies),
	],
}).then(result => {
	if (result.errors.length > 0) {
		console.error(result.errors);
		process.exitCode = 1;
	}
	return write('index.mjs', result.outputFiles[0].text);
}).catch(err => {
	return process.exit(1);
});

let data = await fs.promises.readFile('src/bin.ts', 'utf8');
let bin = await esbuild.transform(data, { ...commons, loader: 'ts' });
await write('bin.js', bin.code);

console.log('---');
