import { findIndex } from './array-utils';

export const BEGIN = '@@optimist/BEGIN';
export const COMMIT = '@@optimist/COMMIT';
export const REVERT = '@@optimist/REVERT';

export const ensureState = state => {
  if (state instanceof Object) {
    if (Array.isArray(state.history)) {
      return state.current;
    }
  }
  return state;
};

const createState = state => ({
  beforeState: undefined,
  history: [],
  current: state
});

const applyCommit = (state, commitId, reducer) => {
  const { history } = state;
  // If the action to commit is the first in the queue (most common scenario)
  if (history[0].meta.optimistic.id === commitId) {
    const historyWithoutCommit = history.slice(1);
    const nextOptimisticIndex = findIndex(historyWithoutCommit, action => action.meta && action.meta.optimistic && !action.meta.optimistic.isNotOptimistic && action.meta.optimistic.id);
    // If this is the only optimistic item in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return {
        ...state,
        history: [],
        beforeState: undefined
      };
    }
    // Create a new history starting with the next one
    const newHistory = historyWithoutCommit.slice(nextOptimisticIndex);
    // And run every action up until that next one to get the new beforeState
    const newBeforeState = history.reduce((mutState, action, index) => {
      return index <= nextOptimisticIndex ? reducer(mutState, action) : mutState;
    }, state.beforeState);

    return {
      ...state,
      history: newHistory,
      beforeState: newBeforeState
    };
  } else {
    // If the committed action isn't the first in the queue, find out where it is
    const actionToCommit = history.find(action => action.meta && action.meta.optimistic && action.meta.optimistic.id === commitId);
    if (!actionToCommit) {
      console.error(`@@optimist: Failed commit. Transaction #${commitId} does not exist!`);
    }
    // Make it a regular non-optimistic action
    const newAction = Object.assign({}, actionToCommit[1], {
      meta: Object.assign({}, actionToCommit[1].meta,
        {optimistic: null})
    });
    return {
      ...state,
      history: [newAction].concat(state.history.slice(1))
    };
  }
};

const applyRevert = (state, revertId, reducer) => {
  const { beforeState, history } = state;
  let newHistory;
  // If the action to revert is the first in the queue (most common scenario)
  if (history[0].meta.optimistic.id === revertId) {
    const historyWithoutRevert = history.slice(1);
    const nextOptimisticIndex = findIndex(historyWithoutRevert, action => action.meta && action.meta.optimistic && !action.meta.optimistic.isNotOptimistic && action.meta.optimistic.id);
    // If this is the only optimistic action in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return {
        ...state,
        history: [],
        current: historyWithoutRevert.reduce((s, action) => reducer(s, action), beforeState),
        beforeState: undefined
      };
    }
    newHistory = historyWithoutRevert.slice(nextOptimisticIndex);
  } else {
    const indexToRevert = findIndex(history, action => action.meta && action.meta.optimistic && action.meta.optimistic.id === revertId);
    if (indexToRevert === -1) {
      console.error(`@@optimist: Failed revert. Transaction #${revertId} does not exist!`);
    }
    newHistory = history.slice();
    newHistory.splice(indexToRevert, 1);
  }
  const newCurrent = newHistory.reduce((s, action) => {
    return reducer(s, action)
  }, beforeState);
  return {
    ...state,
    history: newHistory,
    current: newCurrent,
    beforeState: beforeState,
  }
};

export const optimistic = (reducer, rawConfig = {}) => {
  const config = Object.assign({
    maxHistory: 100
  }, rawConfig);

  return (state, action) => {
    if (state === undefined || action.type === '@@redux/INIT') {
      state = createState(reducer(ensureState(state), {}));
    }
    const historySize = state.history.length;
    const {type, id} = (action.meta && action.meta.optimistic) || {};

    // a historySize means there is at least 1 outstanding fetch
    if (historySize) {
      if (type !== COMMIT && type !== REVERT) {
        if (historySize > config.maxHistory) {
          console.error(`@@optimist: Possible memory leak detected.
                  Verify all actions result in a commit or revert and
                  don't use optimistic-UI for long-running server fetches`);
        }
        // if it's a BEGIN but we already have a historySize, treat it like a non-opt
        return {
          ...state,
          history: state.history.concat([action]),
          current: reducer(state.current, action)
        };
      }
      // for resolutions, add a flag so that we know it is not an optimistic action
      action.meta.optimistic.isNotOptimistic = true;

      // include the resolution in the history & current state
      const nextState = {
        ...state,
        history: state.history.concat([action]),
        current: reducer(state.current, action)
      }
      const applyFunc = type === COMMIT ? applyCommit : applyRevert;
      return applyFunc(nextState, id, reducer);
    }
    // create a beforeState since one doesn't already exist
    if (type === BEGIN) {
      return {
        ...state,
        history: state.history.concat([action]),
        current: reducer(state.current, action),
        beforeState: state.current
      };
    }

    // standard action escape
    return {
      ...state,
      current: reducer(state.current, action)
    };
  };
};
