// import { gzipSync } from 'zlib';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import { dirname, resolve, join } from 'path';
// import { white, red, cyan, dim } from 'kleur';
import * as $ from './utils';

import type { Input } from './types';
import type { Options, Output } from '..';

export async function build(pkgdir: string, options?: Options) {
	options = options || {};
	pkgdir = resolve(pkgdir || '.');

	let rcfile = join(pkgdir, '.terserrc');
	let pkgfile = join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let i=0, key: string; // encoder = new TextEncoder;
	let inputs = await $.inputs(pkgdir, pkg);

	// TODO: find/load config file here

	let builds: Record<string, ReturnType<typeof $.bundle>> = {};

	let config: esbuild.BuildOptions = {
		target: 'es2019',
		sourcemap: false,
		treeShaking: true,
		logLevel: 'warning',
		charset: 'utf8',
		minify: false,
		...options,
		external: options.external || [],
	};

	config.external = builtinModules.concat(
		pkg.external, config.external!
	);

	let outfiles = new Set<string>();
	let mapping: {
		[input: string]: Set<string>; // output[]
	} = {};

	let isDEV = /(^|.)development(.|$)/;
	let isPROD = /(^|.)production(.|$)/;
	let isTYPES = /(^|.)types(.|$)/;

	let [isREQUIRE, isIMPORT] = pkg.module
		? [/(^|.)(require)(.|$)/, /(^|.)(import|default)(.|$)/]
		: [/(^|.)(require|default)(.|$)/, /(^|.)(import)(.|$)/];

	// let isBROWSER = /(^|.)browser(.|$)/;
	// let isNODE = /(^|.)node(.|$)/;

	for (i=0; i < inputs.length; i++) {
		let entry = inputs[i].file;
		let targets = new Set<string>();
		let conditions = inputs[i].output;

		for (key in conditions) {
			let outfile = join(pkgdir, conditions[key]);
			let isRepeat = outfiles.has(outfile);
			let outdir = dirname(outfile);

			if ($.exists(outdir) && outdir !== pkgdir) {
				console.log(" REMOVING %s DIR", outdir);
				// await $.rm(outdir, { recursive: true });
			}

			if (isTYPES.test(key)) {
				// TODO, w/ isDONE marker
			} else {
				let local = { ...config };
				local.minify = local.minify || isPROD.test(key);
				local.sourcemap = local.sourcemap ?? isDEV.test(key);
				console.log({ local });


				// console.log('[TODO] user config', key, entry, config);
				console.log('[TODO] user config', entry, key);

				// force these
				local.write = false;
				local.entryPoints = [entry];
				local.format = 'esm';
				local.bundle = true;

				delete local.outfile;

				let hash = $.fingerprint(local);
				let bundle = builds[hash];

				if (bundle) {
					//
				} else if (isRepeat) {
					return $.throws(`Generating "${conditions[key]}" output using different configurations!`);
				} else {
					builds[hash] = bundle = $.bundle(local);
				}

				let outputs = await bundle;

				if (!outputs) {
					process.exitCode = 1;
					continue;
				}

				if (isIMPORT.test(key)) {
					console.log('> WRITE ESM', key);
					await $.write(outfile, outputs);
				} else if (isREQUIRE.test(key)) {
					console.log('>> CONVERT ESM->CJS', key);
				}

				// console.log({ key, outputs, rewrite: toCommonJS.has(key) });
			}

			// mark as seen
			outfiles.add(outfile);
			targets.add(outfile);
		}

		mapping[entry] = targets;
	}

	console.log('here:', Object.keys(builds));

	await Promise.all(
		Object.values(builds)
	);

	let results: Output = {};
	Object.keys(mapping).sort().forEach(key => {
		results[key] = [...mapping[key]];
	});
	console.log({ results });
	return results;
}
