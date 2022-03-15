#!/usr/bin/env node
const argv = process.argv.slice(2);

import type { Options } from '..';
type Argv = Record<string, string|true>;

(async function () {
	let i=0, j=0, key='';
	let input=[], flags: Argv = {};
	for (; i <= argv.length; i++) {
		if (i === argv.length) {
			if (key) flags[key] = true;
		} else if (argv[i].charCodeAt(0) === 45) {
			if (key) flags[key] = true;

			key = argv[i];
			if (key.charCodeAt(1) !== 45) {
				for (j=key.length-1; j-- > 1;) {
					flags[key[j]] = true;
				}
				key = key[key.length-1];
			}
		} else {
			if (key) flags[key] = argv[i];
			else input.push(argv[i]);
			key = '';
		}
	}

	if (flags['--version'] || flags['-v']) {
		let { version } = require('./package.json');
		return console.log('bundt, v' + version);
	}

	if (flags['--help'] || flags['-h']) {
		let msg = '';
		msg += '\n  Usage';
		msg += '\n    $ bundt [directory] [options]\n';
		msg += '\n  Options';
		msg += '\n    -C, --cwd        TODO';
		msg += '\n    -c, --config     TODO';
		msg += '\n    -t, --target     TODO';
		msg += '\n    -m, --minify     TODO';
		msg += '\n    -x, --sourcemap  TODO';
		msg += '\n    -v, --version    Displays current version';
		msg += '\n    -h, --help       Displays this message\n';
		msg += '\n  Examples';
		msg += '\n    $ bundt --minify';
		msg += '\n    $ bundt -xm --target es2020';
		msg += '\n    $ bundt packages/utils -t=es2020';
		return console.log(msg + '\n');
	}

	// ensure boolean flags dont hoard value
	let minify = flags['minify'] || flags['m'];
	let sourcemap = flags['sourcemap'] || flags['x'];
	if (typeof minify == 'string') input.unshift(minify);
	if (typeof sourcemap == 'string') input.unshift(sourcemap);

	const { resolve } = require('path');
	const bundt = require('.');

	let options: Options = {};
	if (sourcemap) options.sourcemap = true;
	if (minify) options.minify = true;

	let tmp = flags['target'] || flags['t'];
	if (typeof tmp === 'string') options.target = tmp;

	let cwd = resolve(flags['cwd'] || flags['c'] || '.');
	let pkgdir = resolve(cwd, input[0] || '.');

	let output = await bundt.build(pkgdir, options);
	// let table = bundt.report(output, { gzip: true });
})().catch(err => {
	let msg = err && err.message || err;
	msg = msg ? msg.replace(/(\r?\n)/g, '$1      ') : 'Unknown error';
	console.error(red().bold('bundt'), msg);
	process.exit(1);
})
