import test from 'ava';
import 'babel-register';
import {optimistic, BEGIN, COMMIT, REVERT} from '../src/index';
import {Map, List, is} from 'immutable';

const counterReducer = (state = 0, action) => {
  switch (action.type) {
    case 'INC':
      return state + 1;
    case 'DEC':
      return state - 1;
    default:
      return state
  }
};
const rootReducer = (state = {}, action) => ({counter: counterReducer(state.counter, action)});
const rootReducerImmutable = (state = Map(), action) => Map({counter: counterReducer(state.get('counter'), action)});
const makeAction = (type, metaType, id) => ({type, meta: {optimistic: {type: metaType, id}}});

/*Meta tests*/
test('test rootReducer works OK', t => {
  const actual = rootReducer(undefined, {});
  const expected = {counter: 0};
  t.same(actual, expected)
});

test('test rootReducerImmutable works OK', t => {
  const actual = rootReducerImmutable(undefined, {});
  const expected = Map({counter: 0});
  t.true(is(actual, expected))
});

/*BASIC*/
test('wraps a reducer', t => {
  const enhancedReducer = optimistic(rootReducer);
  const actual = enhancedReducer(undefined, {});
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('wraps a reducer with existing state', t => {
  const enhancedReducer = optimistic(rootReducer);
  const actual = enhancedReducer({counter: 5}, {});
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 5}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('wraps an immutable reducer', t => {
  const enhancedReducer = optimistic(rootReducerImmutable);
  const actual = enhancedReducer(undefined, {});
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: Map({counter: 0})
  });
  t.same(actual.toJS(), expected.toJS());
});

/*BEGIN*/
test('begin a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const action = makeAction('INC', BEGIN, 0);
  const actual = enhancedReducer(undefined, action);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(action),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin a second transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const state1 = enhancedReducer(undefined, begin0);
  const actual = enhancedReducer(state1, begin1);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin0, begin1),
    current: {counter: 2}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin a transaction, add a non-opt', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const nonOpt0 = {type: 'DEC'};
  const state1 = enhancedReducer(undefined, begin0);
  const actual = enhancedReducer(state1, nonOpt0);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin0, nonOpt0),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, add non-opt', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const actual = enhancedReducer(state2, nonOpt0);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin0, begin1, nonOpt0),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});


/*COMMIT*/
test('immediately commit a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const commit0 = makeAction('--', COMMIT, 0);
  const actual = enhancedReducer(state1, commit0);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('immediately commit a transaction with success message', t => {
  const successReducer = (state, action) => {
    switch (action.type) {
      case 'SUCCESS':
        return 'Success message';
      default:
        return state
    }
  }
  const rootReducer = (state = {}, action) => ({counter: counterReducer(state.counter, action), success: successReducer(state.success, action)});
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const commit0 = makeAction('SUCCESS', COMMIT, 0);
  const actual = enhancedReducer(state1, commit0);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 1, success: 'Success message'}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, commit the first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const commit0 = makeAction('--', COMMIT, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const actual = enhancedReducer(state2, commit0);
  const expected = Map({
    beforeState: state1.get('current'),
    history: List.of(begin1),
    current: {counter: 2}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, add non-opt action, commit the first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const commit0 = makeAction('--', COMMIT, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, nonOpt0);
  const actual = enhancedReducer(state3, commit0);
  const expected = Map({
    beforeState: state1.get('current'),
    history: List.of(begin1, nonOpt0),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});

///*REVERT*/
test('immediately revert a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const revertAction = makeAction('--', REVERT, 0);
  const actual = enhancedReducer(state1, revertAction);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('immediately revert a transaction with error message', t => {
  const errorReducer = (state, action) => {
    switch (action.type) {
      case 'ERROR':
        return 'Error message';
      default:
        return state
    }
  }
  const rootReducer = (state = {}, action) => ({counter: counterReducer(state.counter, action), error: errorReducer(state.error, action)});
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const revertAction = makeAction('ERROR', REVERT, 0);
  const actual = enhancedReducer(state1, revertAction);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0, error: 'Error message'}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, revert the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const revert0 = makeAction('--', REVERT, 1);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const actual = enhancedReducer(state2, revert0);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin0),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, revert the first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const revert0 = makeAction('--', REVERT, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const actual = enhancedReducer(state2, revert0);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin1),
    current: {counter: 1}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, revert the first, then the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const revert0 = makeAction('--', REVERT, 0);
  const secondRevert = makeAction('--', REVERT, 1);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, revert0);
  const actual = enhancedReducer(state3, secondRevert);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 1, add non-opt, revert it', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('--', REVERT, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, nonOpt0);
  const actual = enhancedReducer(state2, revert0);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: -1}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, add non-opt, revert first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('--', REVERT, 0);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, nonOpt0);
  const actual = enhancedReducer(state3, revert0);
  const expected = Map({
    beforeState: {counter: 0},
    history: List.of(begin1,nonOpt0),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('begin 2, add non-opt, revert the first, commit the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('--', REVERT, 0);
  const commit0 = makeAction('--', COMMIT, 1);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, nonOpt0);
  const fourthState = enhancedReducer(state3, revert0);
  const actual = enhancedReducer(fourthState, commit0);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0}
  });
  t.same(actual.toJS(), expected.toJS());
});

test('real world', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('--', REVERT, 0);
  const nonOpt1 = {type: 'DEC'};
  const begin2 = makeAction('DEC', BEGIN, 2);
  const commit0 = makeAction('--', COMMIT, 1);
  const nonOpt2 = {type: 'DEC'};
  const revert2 = makeAction('--', REVERT, 2);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, nonOpt0);
  const state4 = enhancedReducer(state3, revert0);
  const state5 = enhancedReducer(state4, nonOpt1);
  const state6 = enhancedReducer(state5, begin2);
  const state7 = enhancedReducer(state6, commit0);
  const state8 = enhancedReducer(state7, nonOpt2);
  const actual = enhancedReducer(state8, revert2);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: -2}
  });
  t.same(actual.toJS(), expected.toJS());
});
