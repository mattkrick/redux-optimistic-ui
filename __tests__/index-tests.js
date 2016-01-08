import test from 'ava';
import 'babel-register';
import optimistic, {BEGIN, COMMIT, REVERT} from '../src/index';
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
const rootReducer = (state = {}, action) => {
  return {
    counter: counterReducer(state.counter, action)
  }
};

const rootReducerImmutable = (state = Map(), action) => {
  return Map({
    counter: counterReducer(state.get('counter'), action)
  })
};

const makeAction = (type, metaType, id) => {
  return {
    type,
    meta: {
      optimistic: {
        type: metaType,
        id
      }
    }
  };
};

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
    history: List(),
    current: {
      counter: 0
    }
  });
  t.same(actual.get('current'), expected.get('current'));
  t.true(is(actual.get('history'), expected.get('history')));
});

test('wraps an immutable reducer', t => {
  const enhancedReducer = optimistic(rootReducerImmutable);
  const actual = enhancedReducer(undefined, {});
  const expected = Map({
    history: List(),
    current: Map({
      counter: 0
    })
  });
  t.true(is(actual.current, expected.current));
});

/*BEGIN*/
test('begin a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const action = makeAction('INC', BEGIN, 0);
  const actual = enhancedReducer(undefined, action);
  const expected = Map({
    history: List([{
      action,
      beforeState: undefined
    }]),
    current: {
      counter: 1
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin a second transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstAction = makeAction('INC', BEGIN, 0);
  const secondAction = makeAction('INC', BEGIN, 1);
  const firstState = enhancedReducer(undefined, firstAction);
  const actual = enhancedReducer(firstState, secondAction);
  const expected = Map({
    history: List([
      {
        action: firstAction,
        beforeState: undefined
      },
      {
        action: secondAction,
        beforeState: firstState.get('current')
      }
    ]),
    current: {
      counter: 2
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('history').get(1), expected.get('history').get(1));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin a transaction, add a non-opt', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const nonOpt0 = {type: 'DEC'};
  const state1 = enhancedReducer(undefined, begin0);
  const actual = enhancedReducer(state1, nonOpt0);
  const expected = Map({
    history: List([
      {
        action: begin0,
        beforeState: undefined
      },
      {
        action: nonOpt0
      }
    ]),
    current: {
      counter: 0
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('history').get(1), expected.get('history').get(1));
  t.same(actual.get('current'), expected.get('current'));
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
    history: List([
      {
        action: begin0,
        beforeState: undefined
      },
      {
        action: begin1,
        beforeState: state1.get('current')
      },
      {
        action: nonOpt0
      }
    ]),
    current: {
      counter: 1
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('history').get(1), expected.get('history').get(1));
  t.same(actual.get('history').get(2), expected.get('history').get(2));
  t.same(actual.get('current'), expected.get('current'));
});


/*COMMIT*/
test('immediately commit a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const beginAction = makeAction('INC', BEGIN, 0);
  const firstState = enhancedReducer(undefined, beginAction);
  const commitAction = makeAction('--', COMMIT, 0);
  const actual = enhancedReducer(firstState, commitAction);
  const expected = Map({
    history: List(),
    current: {
      counter: 1
    }
  });
  t.true(is(actual.get('history'), expected.get('history')));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 2, commit the first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstBegin = makeAction('INC', BEGIN, 0);
  const secondBegin = makeAction('INC', BEGIN, 1);
  const firstCommit = makeAction('--', COMMIT, 0);
  const firstState = enhancedReducer(undefined, firstBegin);
  const secondState = enhancedReducer(firstState, secondBegin);
  const actual = enhancedReducer(secondState, firstCommit);
  const expected = Map({
    history: List([
      {
        action: secondBegin,
        beforeState: firstState.get('current')
      }
    ]),
    current: {
      counter: 2
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 2, add non-opt action, commit the first', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstBegin = makeAction('INC', BEGIN, 0);
  const secondBegin = makeAction('INC', BEGIN, 1);
  const firstNonOpt = {type: 'DEC'};
  const firstCommit = makeAction('--', COMMIT, 0);
  const firstState = enhancedReducer(undefined, firstBegin);
  const secondState = enhancedReducer(firstState, secondBegin);
  const thirdState = enhancedReducer(secondState, firstNonOpt);
  const actual = enhancedReducer(thirdState, firstCommit);
  const expected = Map({
    history: List([
      {
        action: secondBegin,
        beforeState: firstState.get('current')
      },
      {
        action: firstNonOpt
      }
    ]),
    current: {
      counter: 1
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('history').get(1), expected.get('history').get(1));
  t.same(actual.get('current'), expected.get('current'));
});

/*REVERT*/
test('immediately revert a transaction', t => {
  const enhancedReducer = optimistic(rootReducer);
  const beginAction = makeAction('INC', BEGIN, 0);
  const firstState = enhancedReducer(undefined, beginAction);
  const revertAction = makeAction('--', REVERT, 0);
  const actual = enhancedReducer(firstState, revertAction);
  const expected = Map({
    history: List(),
    current: undefined
  });
  t.true(is(actual.get('history'), expected.get('history')));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 2, revert the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstBegin = makeAction('INC', BEGIN, 0);
  const secondBegin = makeAction('INC', BEGIN, 1);
  const firstRevert = makeAction('--', REVERT, 1);
  const firstState = enhancedReducer(undefined, firstBegin);
  const secondState = enhancedReducer(firstState, secondBegin);
  const actual = enhancedReducer(secondState, firstRevert);
  const expected = Map({
    history: List([
      {
        action: firstBegin,
        beforeState: undefined
      }
    ]),
    current: {
      counter: 1
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('current'), expected.get('current'));
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
    history: List([
      {
        action: begin1,
        beforeState: undefined
      }
    ]),
    current: {
      counter: 1
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 2, revert the first, then the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstBegin = makeAction('INC', BEGIN, 0);
  const secondBegin = makeAction('INC', BEGIN, 1);
  const firstRevert = makeAction('--', REVERT, 0);
  const secondRevert = makeAction('--', REVERT, 1);
  const firstState = enhancedReducer(undefined, firstBegin);
  const secondState = enhancedReducer(firstState, secondBegin);
  const thirdState = enhancedReducer(secondState, firstRevert);
  const actual = enhancedReducer(thirdState, secondRevert);
  const expected = Map({
    history: List(),
    current: undefined
  });
  t.true(is(actual.get('history'), expected.get('history')));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 1, add non-opt, revert it', t => {
  const enhancedReducer = optimistic(rootReducer);
  const begin0 = makeAction('INC', BEGIN, 0);
  const nonOpt0 = {type: 'DEC'};
  const revert0 = makeAction('--', REVERT, 0);
  const firstState = enhancedReducer(undefined, begin0);
  const secondState = enhancedReducer(firstState, nonOpt0);
  const actual = enhancedReducer(secondState, revert0);
  const expected = Map({
    history: List(),
    current: {
      counter: -1
    }
  });
  t.true(is(actual.get('history'), expected.get('history')));
  t.same(actual.get('current'), expected.get('current'));
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
    history: List([
      {
        action: begin1,
        beforeState: undefined
      },
      {
        action: nonOpt0
      }
    ]),
    current: {
      counter: 0
    }
  });
  t.same(actual.get('history').get(0), expected.get('history').get(0));
  t.same(actual.get('history').get(1), expected.get('history').get(1));
  t.same(actual.get('current'), expected.get('current'));
});

test('begin 2, add non-opt, revert the first, commit the second', t => {
  const enhancedReducer = optimistic(rootReducer);
  const firstBegin = makeAction('INC', BEGIN, 0);
  const secondBegin = makeAction('INC', BEGIN, 1);
  const firstNonOpt = {type: 'DEC'};
  const firstRevert = makeAction('--', REVERT, 0);
  const firstCommit = makeAction('--', COMMIT, 1);
  const firstState = enhancedReducer(undefined, firstBegin);
  const secondState = enhancedReducer(firstState, secondBegin);
  const thirdState = enhancedReducer(secondState, firstNonOpt);
  const fourthState = enhancedReducer(thirdState, firstRevert);
  const actual = enhancedReducer(fourthState, firstCommit);
  const expected = Map({
    history: List(),
    current: {
      counter: 0
    }
  });
  t.true(is(actual.get('history'), expected.get('history')));
  t.same(actual.get('current'), expected.get('current'));
});
