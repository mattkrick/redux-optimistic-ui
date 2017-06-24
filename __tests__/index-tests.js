import test from 'ava';
import 'babel-register';
import {
  optimistic,
  BEGIN,
  COMMIT,
  REVERT,
  ensureState
} from '../src/index';
import {Map, List, is} from 'immutable';
import {createStore, combineReducers} from 'redux';

const INIT_ACTION = { type: '@@redux/INIT' };

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
const enhancedRootReducerNested = combineReducers({
  counter1: combineReducers({ counter: optimistic(counterReducer) }),
  counter2: combineReducers({ counter: optimistic(counterReducer) })
})
const makeAction = (type, metaType, id) => ({type, meta: {optimistic: {type: metaType, id}}});

/*Meta tests*/
test('test rootReducer works OK', t => {
  const actual = rootReducer(undefined, INIT_ACTION);
  const expected = {counter: 0};
  t.deepEqual(actual, expected)
});

test('test rootReducerImmutable works OK', t => {
  const actual = rootReducerImmutable(undefined, INIT_ACTION);
  const expected = Map({counter: 0});
  t.true(is(actual, expected))
});

test('test enhancedRootReducerNested works OK', t => {
  const actual = enhancedRootReducerNested(undefined, INIT_ACTION);
  const expected = Map({
      beforeState: undefined,
      history: List(),
      current: 0
  })
  t.deepEqual(actual.counter1.counter.toJS(), expected.toJS())
  t.deepEqual(actual.counter2.counter.toJS(), expected.toJS())
})

/*BASIC*/
test('wraps a reducer', t => {
  const enhancedReducer = optimistic(rootReducer);
  const actual = enhancedReducer(undefined, INIT_ACTION);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 0}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('wraps a reducer with existing state', t => {
  const enhancedReducer = optimistic(rootReducer);
  const actual = enhancedReducer({counter: 5}, INIT_ACTION);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: 5}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('wraps an immutable reducer', t => {
  const enhancedReducer = optimistic(rootReducerImmutable);
  const actual = enhancedReducer(undefined, INIT_ACTION);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: Map({counter: 0})
  });
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
    history: List.of(begin1, commit0),
    current: {counter: 2}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
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
    history: List.of(begin1, nonOpt0, commit0),
    current: {counter: 1}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('begin 2, commit the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('DEC', BEGIN, 1);
  const commit0 = makeAction('--', COMMIT, 1);

  // optimistic DEC will be converted to a non-opt action in history
  const converted0 = {type: 'DEC', meta: { optimistic: null } };

  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const actual = enhancedReducer(state2, commit0);
  const expected = Map({
    beforeState: actual.get('current'),
    history: List.of(begin0, converted0, commit0),
    current: {counter: 0}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('attempt to commit non-existent transaction id', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const commit0 = makeAction('--', COMMIT, 1);

  const state1 = enhancedReducer(undefined, begin0);
  const error = t.throws(() => enhancedReducer(state1, commit0), Error);
  t.true(error.message.indexOf('Transaction #1 does not exist') !== -1);
});

/*REVERT*/
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
    history: List.of(begin0, revert0),
    current: {counter: 1}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
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
    history: List.of(begin1, revert0),
    current: {counter: 1}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('begin 1 with nested combineReducers, revert', t => {
  const begin = makeAction('INC', BEGIN, 0);
  const revert = makeAction('--', REVERT, 0);
  const state = enhancedRootReducerNested(undefined, begin);
  const actual = enhancedRootReducerNested(state, revert);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: 0
  });
  t.deepEqual(actual.counter1.counter.toJS(), expected.toJS());
  t.deepEqual(actual.counter2.counter.toJS(), expected.toJS());
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
    history: List.of(begin1,nonOpt0, revert0),
    current: {counter: 0}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
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
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('revert and commit have an extra DEC', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const begin1 = makeAction('INC', BEGIN, 1);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('DEC', REVERT, 0);
  const commit0 = makeAction('DEC', COMMIT, 1);
  const state1 = enhancedReducer(undefined, begin0);
  const state2 = enhancedReducer(state1, begin1);
  const state3 = enhancedReducer(state2, nonOpt0);
  const fourthState = enhancedReducer(state3, revert0);
  const actual = enhancedReducer(fourthState, commit0);
  const expected = Map({
    beforeState: undefined,
    history: List(),
    current: {counter: -2}
  });
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('attempt to revert non-existent transaction id', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const revert0 = makeAction('--', REVERT, 1);

  const state1 = enhancedReducer(undefined, begin0);
  const error = t.throws(() => enhancedReducer(state1, revert0), Error);

  t.true(error.message.indexOf('Transaction #1 does not exist') !== -1);
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
  t.deepEqual(actual.toJS(), expected.toJS());
});

test('with redux and initialState without preloadState', t => {
  const enhancedReducer = combineReducers({
    counter: optimistic(counterReducer)
  });
  try {
    const store = createStore(enhancedReducer, {
      counter: 1
    });
    store.dispatch({type: 'INC'});
    t.is(ensureState(store.getState().counter), 2);
  } catch (error) {
    t.fail(error.message)
  }
});
