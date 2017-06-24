import test from 'ava';
import 'babel-register';

import { findIndex } from '../src/array-utils';

const noop = () => {};

test('findIndex returns -1 with empty array', t => {
    const actual = findIndex([], noop);
    t.is(actual, -1);
});

test('findIndex returns -1 with no-op predicate', t => {
    const actual = findIndex([1, 2, 3, 4], noop);
    t.is(actual, -1);
});

test('findIndex returns first match with mutliple match predicate', t => {
    const actual = findIndex([1, 2, 3, 4], e => e % 2 === 0)
    t.is(actual, 1);
});

test('findIndex returns -1 with no match predicate', t => {
    const actual = findIndex([1, 2, 3, 4], e => e % 5 === 0)
    t.is(actual, -1);
});
