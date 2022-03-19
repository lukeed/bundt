import * as fs from 'fs';
import { minify } from 'terser';
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
	await $.write(output, content, {
		require: true,
		minify: {
			compress: true,
			mangle: true,
		}
	});

	console.log('~> write "%s" output~!', output);
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

await write('index.js', index);

let bin = await fs.promises.readFile('src/bin.ts', 'utf8').then(txt => {
	return esbuild.transform(txt, { ...commons, loader: 'ts' });
});

await write('bin.js', bin.code);

console.log('---');
