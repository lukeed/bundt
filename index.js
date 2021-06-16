#!/usr/bin/env node
const { gzipSync } = require('zlib');
const { dirname, normalize, resolve, join, extname } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { white, red, cyan, dim } = require('kleur');

const _ = ' ';
const UNITS = ['B ', 'kB', 'MB', 'GB'];
const lpad = (str, max) => _.repeat(max - str.length) + str;
const rpad = (str, max) => str + _.repeat(max - str.length);
const th = dim().bold().italic().underline;
const filename = white().underline;
const bullet = white().bold;

function bail(err) {
	let msg = (err.message || err || 'Unknown error').replace(/(\r?\n)/g, '$1      ');
	console.error(red().bold('bundt ') + msg);
	process.exit(1);
}

function size(val=0) {
	if (val < 1e3) return `${val} ${UNITS[0]}`;
	let exp = Math.min(Math.floor(Math.log10(val) / 3), UNITS.length - 1) || 1;
	let out = (val / Math.pow(1e3, exp)).toPrecision(3);
	let idx = out.indexOf('.');
	if (idx === -1) {
		out += '.00';
	} else if (out.length - idx - 1 !== 2) {
		out = (out + '00').substring(0, idx + 3); // 2 + 1 for 0-based
	}
	return out + ' ' + UNITS[exp];
}

function write(file, data, isUMD, toDir) {
	file = normalize(file);
	let isDef = /\.d\.ts$/.test(file);
	if (isDef && toDir !== 'default') {
		file = join(toDir, file);
	} else if (toDir && toDir !== 'default') {
		file = normalize(file.replace(dirname(file), toDir));
	}
	mkdir(dirname(file)); // sync
	let code = isDef && data;
	code = code || minify(data, Object.assign({ toplevel:!isUMD }, terser)).code;
	writeFileSync(file, isUMD ? code : data);
	let gzip = size(gzipSync(code).length);
	return { file, size: size(code.length), gzip };
}

function help() {
	let msg = '';
	let warning = dim().red().italic('not built if undefined');
	msg += '\n  Usage\n    $ bundt [entry] [options]\n';
	msg += `\n  Config\n    If no ${dim('[entry]')} was provided, then ${filename('src/index.js')} is used.\n`;
	msg += `\n    Configuration lives within your ${filename('package.json')} file as these keys:`;
	msg += `\n      • ${bullet('"main"')} – the output path for your CommonJS file ${dim().italic(`(default: ${filename(`dist/${pkg.name}.js`)})`)}`;
	msg += `\n      • ${bullet('"module"')} – the output path for your ES Module file ${warning}`;
	msg += `\n      • ${bullet('"unpkg"')} ${dim('or')} ${bullet('"umd:main"')} – the output path for your UMD file ${warning}`;
	msg += `\n      • ${bullet('"browser"')} – the output path for your browser-specific entrypoint ${warning}`;
	msg += `\n      • ${bullet('"umd:name"')} – the name of your UMD factory ${dim().italic(`(default: "${pkg.name}")`)}`;
	msg += `\n      • ${bullet('"modes"')} – a mapping of custom mode names to their entries`;
	msg += `\n      • ${bullet('"terser"')} – a config object to customize Terser behavior\n`;
	msg += `\n    You may use a ${filename('.terserrc')} file to store configuration instead of the ${bullet('"terser"')} key.\n`;
	msg += '\n  Options';
	msg += '\n     ' + dim().italic('All files are built unless 1+ limits are defined');
	msg += `\n    --main        Builds the ${bullet('"main"')} file`;
	msg += `\n    --unpkg       Builds the ${bullet('"unpkg"')} ${dim('or')} ${bullet('"umd:main"')} file`;
	msg += `\n    --module      Builds the ${bullet('"module"')} file`;
	msg += `\n    --browser     Builds the ${bullet('"browser"')} file`;
	msg += `\n    --minify      Minify ${bullet('all')} file formats`;
	msg += '\n    --help, -h    Displays this message\n';
	msg += '\n  Examples\n    $ bundt\n    $ bundt lib/index.js\n    $ bundt src/browser.js --browser --unpkg\n';
	return console.log(msg);
}

const rcfile = resolve('.terserrc');
const pkgfile = resolve('package.json');
const pkg = existsSync(pkgfile) && require(pkgfile);
if (!pkg) return bail(`File not found: ${pkgfile}`);

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) return help();
const isMin = argv.includes('--minify');

const isIndex = !argv[0] || /^-/.test(argv[0]);
const entry = resolve(!argv[0] || /^-/.test(argv[0]) ? 'src/index.js' : argv.shift());
if (!existsSync(entry) && !pkg.modes) return bail(`File not found: ${entry}`);

// We'll actually do something – require deps
const { rewrite } = require('rewrite-imports');
const { mkdir } = require('mk-dirs/sync');
const { minify } = require('terser');

// Parsed config
const fields = {
	main: pkg.main || `dist/${pkg.name}.js`,
	unpkg: pkg.unpkg || pkg['umd:main'],
	module: pkg.module,
	browser: pkg.browser,
};

// Determine if building all or some fields
if (argv.length > 0) {
	let has=0, keys=Object.keys(fields);
	let bools = keys.map(k => argv.includes('--' + k) && ++has);
	if (has > 0) bools.forEach((x, n) => x || delete fields[keys[n]]);
}

const name = pkg['umd:name'] || pkg.name;
const mount = /(.|-|@)/.test(name) ? `['${name}']` : `.${name}`;
const terser = pkg.terser || (existsSync(rcfile) ? JSON.parse(readFileSync(rcfile)) : {});

function capitalize(str) {
	return str[0].toUpperCase() + str.substring(1);
}

function run(filepath, isMode) {
	if (!existsSync(filepath)) return bail(`File not found: ${entry}`);

	let types = '';
	if (isMode) {
		let extn = extname(filepath);
		types = filepath.replace(extn, '.d.ts');
		types = existsSync(types) && readFileSync(types, 'utf8');
	}

	const keys = [];
	const ESM = readFileSync(filepath, 'utf8');
	const isDefault = /export default/.test(ESM);

	let CJS = rewrite(ESM).replace(/(^|;\s*|\r?\n+)export(?:(?:\s*{([^}]*)}(?:(?:;|\s|$)))|( default)|(?: (const|(?:async )?function|class|let|var))\s+([a-z$_][\w$]*))?(?=([^"'`]*["'`][^"'`]*["'`])*[^"'`]*$)/gi, (raw, ws, names, def, type, name) => {
		console.log('HERE', { raw, ws, names, def, type, name });
		if (def) return ws + 'module.exports =';
		if (type) return keys.push(name) && `${ws}${type} ${name}`;
		names.split(',').forEach(name => keys.push(name.trim()));
		return ws;
	});

	if (keys.length > 0) {
		keys.sort().forEach(key => {
			CJS += `\nexports.${key} = ${key};`;
		});
	}

	const UMD = isDefault
		? `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?module.exports=factory():"function"==typeof define&&define.amd?define(factory):global${mount}=factory()}(this,function(){${CJS.replace('module.exports = ', 'return ')}});`
		: `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?factory(exports):"function"==typeof define&&define.amd?define(["exports"],factory):factory(global${mount}={})}(this,function(exports){${CJS}});`

	// Writes
	return Promise.all(
		[
			fields.main && write(fields.main, CJS, isMin, isMode),
			fields.module && write(fields.module, ESM, isMin, isMode),
			fields.browser && write(fields.browser, ESM, isMin, isMode),
			fields.unpkg && write(fields.unpkg, UMD, isMin || 1, isMode),
			types && write('index.d.ts', types, false, isMode),
		].filter(Boolean)
	).then(arr => {
		let label = capitalize(isMode || 'filename');
		let f=label.length, s=8, g=6, out='';

		arr.forEach(obj => {
			f = Math.max(f, obj.file.length);
			s = Math.max(s, obj.size.length);
			g = Math.max(g, obj.gzip.length);
		});

		f += 4; // spacing

		out += th(rpad(label, f)) + _.repeat(4) + th(lpad('Filesize', s)) + '  ' + dim().bold().italic(lpad('(gzip)', g));

		arr.forEach(obj => {
			out += ('\n' + white(rpad(obj.file, f)) + _.repeat(4) + cyan(lpad(obj.size, s)) + '  ' + dim().italic(lpad(obj.gzip, g)));
		});

		console.log('\n' + out + '\n');
	});
}

if (pkg.modes && isIndex) {
	Promise.all(
		Object.keys(pkg.modes).map(k => {
			return run(pkg.modes[k], k);
		})
	).catch(bail);
} else {
	run(entry).catch(bail);
}
