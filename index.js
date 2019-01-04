const { gzipSync } = require('zlib');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { dirname, normalize, resolve } = require('path');
const { white, cyan, dim } = require('kleur');
const imports = require('rewrite-imports');
const { minify } = require('terser');
const mkdir = require('mk-dirs');

const _ = ' ';
const gutter = _.repeat(4);
const UNITS = ['B ', 'kB', 'MB', 'GB'];
const lpad = (str, max) => _.repeat(max - str.length) + str;
const rpad = (str, max) => str + _.repeat(max - str.length);
const th = dim().bold().italic().underline;

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

function write(file, data, isUMD) {
	file = normalize(file);
	return mkdir(dirname(file)).then(() => {
		let { code } = minify(data, Object.assign({ toplevel:!isUMD }, terser));
		writeFileSync(file, isUMD ? code : data);
		let gzip = size(gzipSync(code).length);
		return { file, size:size(code.length), gzip };
	});
}

const rcfile = resolve('.terserrc');
const pkgfile = resolve('package.json');
const pkg = existsSync(pkgfile) && require(pkgfile);
if (!pkg) return console.log('Does not exist: %s', pkgfile);

const argv = process.argv.slice(2);
const entry = resolve(argv[0] || 'src/index.js');
if (!existsSync(entry)) return console.log('Does not exist: %s', entry);

// Parsed config
const output = {
	cjs: pkg.main || `dist/${pkg.name}.js`,
	umd: pkg.unpkg || pkg['umd:main'],
	esm: pkg.module,
};

const ESM = readFileSync(entry, 'utf8');
const isDefault = /export default/.test(ESM);

const name = pkg['umd:name'] || pkg.name;
const mount = /[.-]/.test(name) ? `['${name}']` : `.${name}`;
const terser = pkg.terser || existsSync(rcfile) ? JSON.parse(readFileSync(rcfile)) : {};

let keys = [];
let CJS = imports(ESM)
	.replace(/export default/, 'module.exports =')
	.replace(/export (const|function) (.+?)(?=(\(|\s|\=))/gi, (_, type, name) => {
		return keys.push(name) && `${type} ${name}`;
	});

if (keys.length > 0) {
	keys.sort().forEach(key => {
		CJS += `\nexports.${key} = ${key};`;
	});
}

const UMD = isDefault
	? `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?module.exports=factory():"function"==typeof define&&define.amd?define(factory):global${mount}=factory()}(this,function(){${CJS.replace(/module.exports=/, 'return ')}});`
	: `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?factory(exports):"function"==typeof define&&define.amd?define(["exports"],factory):factory(global${mount}={})}(this,function(global){${CJS}});`

// Writes
Promise.all([
	output.cjs && write(output.cjs, CJS),
	output.esm && write(output.esm, ESM),
	output.umd && write(output.umd, UMD, 1),
].filter(Boolean)).then(arr => {
	let f=0, s=0, g=0, out='';

	arr.forEach(obj => {
		f = Math.max(f, obj.file.length);
		s = Math.max(s, obj.size.length);
		g = Math.max(g, obj.gzip.length);
	});

	f += 4; // spacing
	s += 4;

	out += th(rpad('Filename', f)) + gutter + th(lpad('Filesize', s)) + _ + _ + dim().bold().italic(lpad('(gzip)', g));

	arr.forEach(obj => {
		out += ('\n' + white(rpad(obj.file, f)) + gutter + cyan(lpad(obj.size, s)) + dim().italic(_ + _ + lpad(obj.gzip, g)));
	});

	console.log(out);
});
