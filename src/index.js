import {List, Map} from 'immutable';

export const BEGIN = '@@optimist/BEGIN';
export const COMMIT = '@@optimist/COMMIT';
export const REVERT = '@@optimist/REVERT';

const getCommitHistory = (history, commitId) => {
  let started;
  let committed;
  const newHistory = history.reduce((mutHistory, entry) => {
    if (!entry.hasOwnProperty('beforeState')) {
      return started ? mutHistory.push(entry) : mutHistory;
    }
    // Since we know the entry & action are optimistic, they have an id
    const matchesTransaction = entry.action.meta.optimistic.id === commitId;
    if (matchesTransaction) {
      committed = true;
      // If it's the first, don't store it in the newHistory, else, we can ditch the beforeState
      return started ? mutHistory.push({action: entry.action}) : mutHistory;
    }
    started = true;
    return mutHistory.push(entry);
  }, List());
  if (!committed) {
    console.error(`@@optimist: Failed commit. Transaction #${commitId} does not exist!`);
  }
  return newHistory;
};

const getRevertState = (history, revertId, reducer) => {
  let started;
  let gotInitialState;
  let currentState;
  const newHistory = history.reduce((mutHistory, entry) => {
    if (entry.hasOwnProperty('beforeState')) {
      const matchesTransaction = entry.action.meta.optimistic.id === revertId;
      if (matchesTransaction) {
        currentState = entry.beforeState;
        // It's possible the currentState could be set to undefined by a reducer, so this is necessary
        gotInitialState = true;
        return mutHistory;
      }
      started = true;
      if (gotInitialState) {
        const ret = mutHistory.push({
          beforeState: currentState,
          action: entry.action
        });
        currentState = reducer(currentState, entry.action);
        return ret;
      }
      return mutHistory.push(entry);
    }
    currentState = gotInitialState ? reducer(currentState, entry.action) : currentState;
    return started ? mutHistory.push(entry) : mutHistory;
  }, List());
  if (!gotInitialState) {
    console.error(`@@optimist: Failed revert. Transaction #${revertId} does not exist!`);
  }
  return Map({
    current: currentState,
    history: newHistory
  });
};

export const optimistic = (reducer, rawConfig = {}) => {
  const config = Object.assign({
    maxHistory: 100
  }, rawConfig);
  let isReady = false;

  return (state, action) => {
    let historySize;
    if (!isReady) {
      isReady = true;
      state = Map({
        history: List(),
        current: reducer(state, {})
      });
    }
    const metaAction = (action.meta && action.meta.optimistic) || {};
    switch (metaAction.type) {
      case BEGIN:
        return state.withMutations(mutState => {
          mutState
            .set('history', state.get('history').push({action, beforeState: state.get('current')}))
            .set('current', reducer(state.get('current'), action));
        });
      case COMMIT:
        return state.withMutations(mutState => {
          mutState
            .set('history', getCommitHistory(state.get('history'), metaAction.id))
            .set('current', reducer(state.get('current'), action));
        });
      case REVERT:
        return getRevertState(state.get('history'), metaAction.id, reducer);
      default:
        historySize = state.get('history').size;
        if (historySize) {
          if (historySize > config.maxHistory) {
            console.error(`@@optimist: Possible memory leak detected.
              Verify all actions result in a commit or revert and
              don't use optimistic-UI for long-running server fetches`);
          }
          return state.withMutations(mutState => {
            mutState
              .set('history', state.get('history').push({action}))
              .set('current', reducer(state.get('current'), action));
          });
        }
        return state.set('current', reducer(state.get('current'), action));
    }
  };
};

export const ensureState = state => {
  if (Map.isMap(state)) {
    if (List.isList(state.get('history'))) {
      return state.get('current');
    }
  }
  return state;
};


