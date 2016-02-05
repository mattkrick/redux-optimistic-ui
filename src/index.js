import {List, Map} from 'immutable';

export const BEGIN = '@@optimist/BEGIN';
export const COMMIT = '@@optimist/COMMIT';
export const REVERT = '@@optimist/REVERT';

export const ensureState = state => {
  if (Map.isMap(state)) {
    if (List.isList(state.get('history'))) {
      return state.get('current');
    }
  }
  return state;
};

const applyCommit = (state, commitId, reducer) => {
  const history = state.get('history');
  // If the action to commit is the first in the queue (most common scenario)
  if (history.first().meta.optimistic.id === commitId) {
    const historyWithoutCommit = history.shift();
    const nextOptimisticIndex = historyWithoutCommit.findIndex(action => action.meta && action.meta.optimistic && action.meta.optimistic.id);
    // If this is the only optimistic item in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return state.withMutations(mutState => {
        mutState
          .set('history', List())
          .set('beforeState', undefined)
      });
    }
    // Create a new history starting with the next one
    const newHistory = historyWithoutCommit.skip(nextOptimisticIndex);
    // And run every action up until that next one to get the new beforeState
    const newBeforeState = history.reduce((mutState, action, index) => {
      return index <= nextOptimisticIndex ? reducer(mutState, action) : mutState;
    }, state.get('beforeState'));
    return state.withMutations(mutState => {
      mutState
        .set('history', newHistory)
        .set('beforeState', newBeforeState)
    });
  } else {
    // If the committed action isn't the first in the queue, find out where it is
    const actionToCommit = history.findEntry(action => action.meta && action.meta.optimistic && action.meta.optimistic.id === commitId);
    if (!actionToCommit) {
      console.error(`@@optimist: Failed commit. Transaction #${commitId} does not exist!`);
    }
    // Make it a regular non-optimistic action
    const newAction = Object.assign({}, actionToCommit[1], {
      meta: Object.assign({}, actionToCommit[1].meta,
        {optimistic: null})
    });
    return state.set('history', state.get('history').set(actionToCommit[0], newAction))
  }
};

const applyRevert = (state, revertId, reducer) => {
  const history = state.get('history');
  const beforeState = state.get('beforeState');
  let newHistory;
  let newBeforeState;
  // If the action to revert is the first in the queue (most common scenario)
  if (history.first().meta.optimistic.id === revertId) {
    const historyWithoutRevert = history.shift();
    const nextOptimisticIndex = historyWithoutRevert.findIndex(action => action.meta && action.meta.optimistic && action.meta.optimistic.id);
    // If this is the only optimistic action in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return state.withMutations(mutState => {
        mutState
          .set('history', List())
          .set('current', historyWithoutRevert.reduce((mutState, action) => reducer(mutState, action), beforeState))
          .set('beforeState', undefined)
      });
    }
    newHistory = historyWithoutRevert.skip(nextOptimisticIndex);
    newBeforeState = beforeState;
  } else {
    const indexToRevert = history.findIndex(action => action.meta && action.meta.optimistic && action.meta.optimistic.id === revertId);
    if (indexToRevert === -1) {
      console.error(`@@optimist: Failed revert. Transaction #${revertId} does not exist!`);
    }
    newHistory = history.delete(indexToRevert);
    newBeforeState = beforeState;
  }
  const newCurrent = newHistory.reduce((mutState, action) => {
    return reducer(mutState, action)
  }, beforeState);
  return state.withMutations(mutState => {
    mutState
      .set('history', newHistory)
      .set('current', newCurrent)
      .set('beforeState', newBeforeState)
  });
};

export const optimistic = (reducer, rawConfig = {}) => {
  const config = Object.assign({
    maxHistory: 100
  }, rawConfig);
  let isReady = false;

  return (state, action) => {
    if (!isReady || state === undefined) {
      isReady = true;
      state = Map({
        history: List(),
        current: reducer(ensureState(state), {}),
        beforeState: undefined
      });
    }
    const historySize = state.get('history').size;
    const metaAction = (action.meta && action.meta.optimistic) || {};
    let {type, id} = metaAction;
    if (type === BEGIN && historySize) {
      // Don't save a second state
      type = null;
    }
    switch (type) {
      case BEGIN:
        return state.withMutations(mutState => {
          mutState
            .set('history', state.get('history').push(action))
            .set('current', reducer(state.get('current'), action))
            .set('beforeState', state.get('current'))
        });
      case COMMIT:
        return applyCommit(state, id, reducer);
      case REVERT:
        return applyRevert(state, id, reducer);
      default:
        if (historySize) {
          if (historySize > config.maxHistory) {
            console.error(`@@optimist: Possible memory leak detected.
              Verify all actions result in a commit or revert and
              don't use optimistic-UI for long-running server fetches`);
          }
          return state.withMutations(mutState => {
            mutState
              .set('history', state.get('history').push(action))
              .set('current', reducer(state.get('current'), action));
          });
        }
        return state.set('current', reducer(state.get('current'), action));
    }
  };
};


