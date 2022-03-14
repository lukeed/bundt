// import { gzipSync } from 'zlib';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import { dirname, resolve, join } from 'path';
// import { existsSync, readFileSync, writeFileSync } from 'fs';
// import { white, red, cyan, dim } from 'kleur';
import * as $ from './utils';

import type { Input } from './types';
import type { Options } from '..';

export async function build(pkgdir?: string, options?: Options) {
	options = options || {};
	pkgdir = resolve(pkgdir || '.');

	let rcfile = join(pkgdir, '.terserrc');
	let pkgfile = join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let i=0, encoder = new TextEncoder;
	let outputs = new Map<string, Input>();

	let inputs = await $.inputs(pkgdir, pkg);
	console.log({ inputs, pkgdir, pkg });

	let config: esbuild.BuildOptions = {
		target: 'es2019', // TODO: --target=es2019
		treeShaking: true, // TODO: --minify || !condition.has(development)
		sourcemap: false, // TODO: --sourcemap
		logLevel: 'warning',
		minify: true, // TODO: --minify or !condition.has(production)
		charset: 'utf8',
		...options,
		external: options.external || [],
	};

	config.external = builtinModules.concat(
		pkg.external, config.external!
	);

	console.log({ inputs });

	for (; i < inputs.length; i++) {
		outputs.set(inputs[i].output, inputs[i]);
	}

	// TODO :: try/catch
	await Promise.all(
		[...outputs.values()].map(async opts => {
			let outfile = join(pkgdir!, opts.output);

			// build ts -> esm
			let esm = await esbuild.build({
				...config,
				// force these
				write: false,
				format: 'esm',
				outfile: outfile,
				entryPoints: [opts.input],
				bundle: true,
			}).then(bundle => {
				return bundle.outputFiles[0];
			});

			let outdir = dirname(esm.path);
			console.log({ outdir  });

			if (outdir !== pkgdir) {
				// purge existing
				if ($.exists(outdir)) {
					console.log(" REMOVING %s DIR", outdir);
					// await $.rm(outdir, {
					// 	recursive: true,
					// 	force: true,
					// });
				}

				// create dir (safe writes)
				await $.mkdir(outdir);
			}

			if (opts.esm) {
				await $.write(esm.path, esm.contents);
			} else {
				// convert esm -> cjs
				outfile = join(pkgdir!, outfile);
				await $.write(outfile, '// COMMONJS');
			}

			// TODO: index.d.ts
		})
	);

	console.log('~> done', [...outputs]);
	// utils.table(pkg.name, pkgdir, outputs);
}
