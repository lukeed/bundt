import * as fs from 'fs';
import { minify } from 'terser';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import * as pkg from './package.json';

let commons: esbuild.CommonOptions = {
	minify: true,
	charset: 'utf8',
	logLevel: 'warning',
	target: 'es2020',
};

async function write(output: string, content: string) {
	let data = await minify(content, {
		module: true,
		compress: true,
		mangle: true,
	});

	if (data.code) {
		await fs.promises.writeFile(output, content);
		console.log('~> write "%s" output~!', output);
	} else {
		console.error('Missing "code" key post-minify');
		process.exitCode = 1;
	}
}

console.log('---');

let index = await esbuild.build({
	...commons,
	write: false,
	entryPoints: ['src/index.ts'],
	format: 'esm',
	bundle: true,
	external: [
		pkg.name,
		...builtinModules,
		...Object.keys(pkg.dependencies),
	],
}).then(result => {
	if (result.errors.length > 0) {
		process.exitCode = 1;
	}
	return result.outputFiles[0].text;
}).catch(err => {
	return process.exit(1);
});

await write('index.mjs', index);

let bin = await fs.promises.readFile('src/bin.ts', 'utf8').then(txt => {
	return esbuild.transform(txt, { ...commons, loader: 'ts' });
});

await write('bin.js', bin.code);

console.log('---');
