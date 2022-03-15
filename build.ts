import * as fs from 'fs';
import { minify } from 'terser';
import * as esbuild from 'esbuild';

async function build(
	input: string,
	output: string,
	options: esbuild.BuildOptions
) {
	try {
		var result = await esbuild.build({
			...options,
			entryPoints: [input],
			logLevel: 'warning',
			target: 'es2020',
			write: false,
			minify: true,
		});
		if (result.errors.length > 0) {
			process.exitCode = 1;
		}
	} catch (err) {
		return process.exitCode = 1;
	}

	let content = result.outputFiles[0].text;

	let data = await minify(content, {
		module: true,
		compress: true,
		mangle: true,
	});

	if (data.code) {
		await fs.promises.writeFile(output, data.code);
		console.log('~> write "%s" output~!', output);
	} else {
		console.error('Missing "code" key post-minify');
		process.exitCode = 1;
	}
}

await build('src/index.ts', 'index.mjs', {
	format: 'esm'
});
