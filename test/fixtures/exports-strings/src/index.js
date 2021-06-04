export function hello() {
	return 'import{foo}from"bar";export const bar = foo + 123;';
}

export function world() {
	return "export { foo } from 'foobar'";
}

export function there() {
	return 'var foo=123;export default foo';
}

export const hiya = true;

let foo=1, bar=2, foobar=3;

export{ foo, bar };
export {   foobar  };
