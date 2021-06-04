function hello() {
	return 'import{foo}from"bar";export const bar = foo + 123;';
}

function world() {
	return "export { foo } from 'foobar'";
}

function there() {
	return 'var foo=123;export default foo';
}

const hiya = true;

let foo=1, bar=2, foobar=3;




exports.bar = bar;
exports.foo = foo;
exports.foobar = foobar;
exports.hello = hello;
exports.hiya = hiya;
exports.there = there;
exports.world = world;
