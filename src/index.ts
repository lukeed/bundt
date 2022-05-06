import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import * as colors from './colors';
import * as $ from './utils';

import type { MinifyOptions } from 'terser';
import type { Chunk, FileData, Normal } from './types';
import type { Options, Output } from '..';

type BUILDHASH = string;

export async function build(pkgdir: string, options?: Options) {
	let cwd = $.resolve('.');

	options = options || {};
	pkgdir = $.resolve(pkgdir || '.');

	let rcfile = $.join(pkgdir, '.terserrc');
	let pkgfile = $.join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let conditions: Normal.Conditions;
	let inputs = await $.inputs(pkgdir, pkg);
	let i=0, j=0, key: string, outfile: string;

	let tmp, hashkey: string;
	let IGNORES = new Set<string>();

	let terser = $.exists(rcfile) && await $.toJSON<MinifyOptions>(rcfile) || {};

	let uconfig = await $.find(cwd, pkgdir);
	let customize = uconfig && await $.load(uconfig);

	let OUTDIRS = new Set<string>();
	let outfiles = new Set<string>();

	let builds: Record<string, ReturnType<typeof $.bundle>> = {};
	let externals = builtinModules.concat(
		pkg.external, options.external || []
	);

	let graph: {
		[input: string]: Set<string>; // output[]
	} = {};

	let CHUNKS: Record<BUILDHASH, Chunk[]> = {};
	let HASHES: { [entry_key: string]: BUILDHASH } = {};

	let MATCHES: RegExp[] = [];
	let NOMATCHES: RegExp[] = [];
	let RELATIVE = /^([.]{1,2}[/]){1,}/;

	if (pkg.files) {
		pkg.files.length || $.throws(`Empty "files" array!`);

		for (i=0; i < pkg.files.length; i++) {
			tmp = pkg.files[i].replace(/([.+?$])/g, '\\$1').replace(/[*]/g, '.+');
			if (pkg.files[i].startsWith('!')) NOMATCHES.push(new RegExp(tmp.substring(1), 'i'));
			else MATCHES.push(new RegExp(tmp, 'i'));
		}
	}

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

		conditions = inputs[i].output;

		for (key in conditions) {
			hashkey = inputs[i].entry + '>' + key;

			// "./foobar/index.js" => "foobar/index.js"
			outfile = conditions[key].replace(RELATIVE, '');

			for (j=0; j < NOMATCHES.length; j++) {
				if (NOMATCHES[j].test(outfile)) {
					$.throws(`The "${outfile}" output for "${hashkey}" will not be published because of a "files" entry!`);
				}
			}

			if (j = MATCHES.length) {
				while (j-- > 0) {
					if (MATCHES[j].test(outfile)) break;
				}
				if (j < 0) {
					$.throws(`The "${outfile}" output for "${hashkey}" did not match any "files" entry!`);
				}
			}

			outfile = $.join(pkgdir, conditions[key]);
			let isRepeat = outfiles.has(outfile);

			tmp = $.dirname(outfile);
			inputs[i].outdirs ||= new Set;
			inputs[i].outdirs!.add(tmp);
			OUTDIRS.add(tmp);

			if (isTYPES.test(key)) {
				IGNORES.add(hashkey);
				if (inputs[i].types) {
					inputs[i].typeout ||= new Set;
					inputs[i].typeout!.add(outfile);
				}
			} else {
				let config: esbuild.BuildOptions = {
					target: 'es2020',
					treeShaking: true,
					logLevel: 'warning',
					charset: 'utf8',
					...options,
				};

				config.external = [...externals];
				config.minify ??= isPROD.test(key);
				config.sourcemap ??= isDEV.test(key);

				// temporary; for "bin" output
				// should have o.transform or bins list
				config.format = 'esm';
				config.bundle = true;

				tmp = {
					file: entry,
					export: inputs[i].entry,
					condition: key,
				};

				if (customize) {
					let c = await customize(tmp, config);
					if (c === false) {
						IGNORES.add(hashkey);
						OUTDIRS.delete(
							$.dirname(outfile)
						);
						continue;
					} else if (c && typeof c === 'object') {
						config = c;
					}
					entry = tmp.file || entry;
				}

				if (!entry) {
					entry = inputs[i].entry;
					tmp = entry.replace('./', '');
					if (tmp === '.') tmp = 'index';
					return $.throws(`Missing \`${tmp}.([cm]?[tj]sx?)\` file for "${entry}" entry`);
				}

				let isMinify = !!config.minify;

				// force these
				config.write = false;
				config.minify = false; // terser comments
				config.entryPoints = [entry];
				// config.format = 'esm';
				// config.bundle = true;

				delete config.outfile;

				let hash: BUILDHASH = $.fingerprint(config);
				let bundle = builds[hash];

				if (bundle) {
					//
				} else if (isRepeat) {
					return $.throws(`Generating "${conditions[key]}" output using different configurations!`);
				} else {
					builds[hash] = bundle = $.bundle(config, terser, isMinify);
				}

				let chunks = await bundle;

				if (!chunks) {
					process.exitCode = 1;
					continue;
				}

				if (isIMPORT.test(key)) {
					hash += '|import';
					CHUNKS[hash] ||= chunks;
					HASHES[hashkey] = hash;
				} else if (isREQUIRE.test(key)) {
					hash += '|require';
					HASHES[hashkey] = hash;
					if (CHUNKS[hash] == null) {
						CHUNKS[hash] = [];
						for (j=0; j < chunks.length; j++) {
							tmp = chunks[j];
							CHUNKS[hash].push({
								name: tmp.name,
								text: $.convert(tmp.text, isMinify),
							});
						}
					}
				} else {
					$.throws(`Unknown "${key}" condition for "${inputs[i].entry}" entry`);
				}
			}

			// mark as seen
			outfiles.add(outfile);
			targets.add(outfile);
		} // end per-condition

		if (targets.size) {
			graph[entry!] = targets;
		}
	}

	await Promise.all(
		Object.values(builds)
	);

	let WRITES: Array<[string, string]> = [];
	for (i=0; i < inputs.length; i++) {
		conditions = inputs[i].output;

		for (key in conditions) {
			hashkey = inputs[i].entry + '>' + key;
			if (IGNORES.has(hashkey)) continue;

			let hash = HASHES[hashkey];
			if (!hash) $.throws(`Missing output files for "${hashkey}" build`);

			outfile = $.join(pkgdir, conditions[key]);
			if (CHUNKS[hash]) WRITES.push([outfile, hash]);
			else $.throws(`Invalid "${hash}" identifier`);
		}
	}

	OUTDIRS.delete(pkgdir);
	await $.reset([...OUTDIRS]);

	await Promise.all(
		WRITES.map(args => {
			return $.write(args[0], CHUNKS[args[1]]!);
		})
	);

	for (i=0; i < inputs.length; i++) {
		tmp = inputs[i];

		let src = tmp.types;
		if (!src) continue;

		let file = tmp.file!;
		let arr = tmp.typeout ? [ ...tmp.typeout ] : [ ...tmp.outdirs! ].map(d => {
			return $.join(d, 'index.d.ts');
		});

		await Promise.all(
			arr.map(f => {
				graph[file].add(f);
				return $.copy(src!, f);
			})
		);
	}

	let results: Output = {};
	Object.keys(graph).sort().forEach(key => {
		results[key] = [...graph[key]];
	});
	return results;
}

export async function report(results: Output, options: {
	cwd?: string;
	gzip?: boolean;
	delta?: [number, number];
	colors?: boolean;
} = {}): Promise<string> {
	let gzip = !!options.gzip;
	let cwd = $.resolve(options.cwd || '.');
	if (options.colors === false) colors.disable();

	let max=0, f=4, s=8, g=6;
	let i=0, input: string, output='', tmp;
	let record: Record<string, FileData[]> = {};

	for (input in results) {
		let files: FileData[] = [];

		await Promise.all(
			results[input].map(async file => {
				let stats = await $.inspect(file, gzip);

				if (stats) {
					stats.file = $.normalize(
						$.relative(cwd, stats.file)
					);

					f = Math.max(f, stats.file.length);
					s = Math.max(s, stats.size.length);
					if (stats.gzip) {
						g = Math.max(g, stats.gzip.length);
					}

					files.push(stats);
				}
			})
		);

		input = $.normalize(
			$.relative(cwd, input)
		);

		f = Math.max(f, input.length);

		i = 4 + 2 + f + s;
		if (gzip) i += 2 + g;
		max = Math.max(max, i);

		record[input] = files.sort((a, b) => {
			return a.file.localeCompare(b.file);
		});
	}

	f += 2; // extend underline
	max += 2;

	for (input in record) {
		output += '\n  ' + colors.input($.rpad(input, f));
		output += '    ' + colors.th($.lpad('Filesize', s));
		if (gzip) output += '  ' + colors.th($.lpad('(gzip)', g));

		for (i=0; i < record[input].length; i++) {
			tmp = record[input][i];
			output += '\n    ' + colors.white($.rpad(tmp.file, f));
			output += '  ' + colors.cyan($.lpad(tmp.size, s));
			if (gzip) output += '  ' + colors.gzip(
				$.lpad(tmp.gzip as string, g)
			);
		}

		output += '\n';
	}

	if (options.delta) {
		tmp = 'Done in ' + $.time(...options.delta);
		max = Math.max(max, tmp.length);
		output += '\n' + $.lpad(tmp, max) + '\n';
	}

	return '\n' + output + '\n';
}
