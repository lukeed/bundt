const fs = require('fs');
const test = require('tape');
const { parse, join } = require('path');
const { spawnSync } = require('child_process');
const bin = require.resolve('..');

const fixtures = join(__dirname, 'fixtures');

const tests = {
	cjs: /(module\.)?exports(\.?)/,
	esm: /export (default )?(function|const|class|let|var)/,
	umd: new RegExp(`"object"==typeof exports&&"undefined"!=typeof module`)
};

function exec(cwd, src) {
	let args = [bin].concat(src || []);
	return spawnSync('node', args, { cwd });
}

function toFiles(t, dir, obj={}) {
	let k, file, data;

	for (k in obj) {
		if (/entry|name/.test(k)) continue;
		file = join(dir, obj[k]);
		t.true(fs.existsSync(file), `(${k}) ~> file exists`);
		data = fs.readFileSync(file, 'utf8');
		t.true(tests[k].test(data), `(${k}) ~> contents look right`);
		if (k === 'cjs') {
			t.doesNotThrow(() => new Function(data), SyntaxError, `(${k}) ~> does not throw`);
		} else if (k === 'umd' && 'name' in obj) {
			t.true(data.includes(obj.name), `(${k}) ~> has custom UMD name`);
		}
		fs.unlinkSync(file);
	}

	fs.rmdirSync(parse(file).dir);
}

function toTest(dirname) {
	let dir = join(fixtures, dirname);
	let expects = require( join(dir, 'expects.json') );

	test(dirname, t => {
		let pid = exec(dir, expects.entry);
		t.is(pid.status, 0, 'runs without error');
		t.ok(pid.stdout.length, 'prints table to stdout');
		toFiles(t, dir, expects);
		t.end();
	});
}

// --- init

fs.readdir(fixtures, (err, dirs) => {
	if (err) throw err;
	dirs.forEach(toTest);
});
