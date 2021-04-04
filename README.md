[![npm version](https://badge.fury.io/js/redux-optimistic-ui.svg)](https://badge.fury.io/js/redux-optimistic-ui)
[![Build Status](https://travis-ci.org/mattkrick/redux-optimistic-ui.svg?branch=master)](https://travis-ci.org/mattkrick/redux-optimistic-ui)
[![Coverage Status](https://coveralls.io/repos/github/mattkrick/redux-optimistic-ui/badge.svg?branch=master)](https://coveralls.io/github/mattkrick/redux-optimistic-ui?branch=master)

# redux-optimistic-ui
a reducer enhancer to enable type-agnostic optimistic updates

## Installation
`yarn add redux-optimistic-ui`

## A what-now?
A reducer enhance is a function you put around a reducer.
It can be your rootReducer (the output from a `combineReducers`) or a nested one.
Optimistic-UI means you update what the client sees before the result comes back from the server.
This makes your app feel super fast, regardless of server location or internet connection speed.

## How's it different from redux-optimist?

| redux-optimistic-ui                                    | redux-optimist                                                    |
|--------------------------------------------------------|-------------------------------------------------------------------|
| reducerEnhancer (wraps your state)                     | reducerExtender (adds an optimist to your state)                  |
| can use immutable.js or anything else                  | must use plain JS objects for your state                          |
| only uses 1 state copy                                 | saves an extra copy of your state for every new optimistic action |
| FSA compliant                                          | not FSA compliant                                                 |
| must wrap your state calls in `ensureState`            | no change necessary to get your state                             |

## Usage

### Feed it your reducer

```js
import {optimistic} from 'redux-optimistic-ui';
return optimistic(reducer);
```

This will transform your state so it looks like this:

```js
state = {
  history: [],
  beforeState: <YOUR PREVIOUS STATE HERE>
  current: <YOUR STATE HERE>
}
```
If the client is not waiting for a response from the server, the following are guaranteed to be true:
- `state.history.length === 0`
- `state.beforeState === undefined`

If you don't need to know if there is an outstanding fetch, you'll never need to use these.

### Update your references to `state`

Since your state is now wrapped, you need `state.current`.
But that sucks. What if you don't enhance the state until the user hits a certain route?
Lucky you! There's a function for that. `ensureState` will give you your state whether it's enhanced or not.
Just wrap all your references to `state` and `getState` with it & you're all set!

```js
// Before
getState().counter

// After (whether you've enhanced your reducer or not)
import {ensureState} from 'redux-optimistic-ui'
ensureState(getState()).counter
```

### Update actions

Now comes the fun! Not all of your actions should be optimistic.
Just the ones that fetch something from a server *and have a high probability of success*.
We are using redux-thunk for the asynchronous logic example, but this is not required:

```js
import { BEGIN, COMMIT, REVERT } from "redux-optimistic-ui";
import { makeRequest, getUuid } from "./helpers";

export const actionTypes = {
  CHANGE_COLOR: "CHANGE_COLOR",
  CHANGE_COLOR_SUCCESS: "CHANGE_COLOR_SUCCESS",
  CHANGE_COLOR_FAILURE: "CHANGE_COLOR_FAILURE"
};

// non-prod ready!
function getUuid() {
  return Math.random();
}

export const actions = {
  changeColor: (payload) => ({ type: actionTypes.CHANGE_COLOR, payload }),
  changeColorSuccess: (payload) => ({
    type: actionTypes.CHANGE_COLOR_SUCCESS,
    payload
  }),
  changeColorFailure: (payload) => ({
    type: actionTypes.CHANGE_COLOR_FAILURE,
    payload
  }),
  // redux-thunk action creator
  changeColorAsync: (payload) => (dispatch) => {
    const transactionID = getUuid();

    const actionBegin = {
      ...actions.changeColor(payload),
      meta: { optimistic: { type: BEGIN, id: transactionID } }
    };

    dispatch(actionBegin);
    return makeRequest(dispatch)
      .then(() => {
        const actionRevert = {
          ...actions.changeColorSuccess({}),
          meta: { optimistic: { type: REVERT, id: transactionID } }
        };
        dispatch(actionRevert);
      })
      .catch(() => {
        const actionCommit = {
          ...actions.changeColorFailure({}),
          meta: { optimistic: { type: COMMIT, id: transactionID } }
        };
        dispatch(actionCommit);
      });
  }
};
```

## Example
Sandbox example - https://codesandbox.io/s/redux-optimistic-update-g0mrb

## Pro tips
Not using an optimistic-ui until a certain route? Using something like `redux-undo` in other parts? Write a little something like this and call it on your asychronous route:

```js
export default (newReducers, reducerEnhancers) => {
  Object.assign(currentReducers, newReducers);
  const reducer = combineReducers({...currentReducers})
  if (reducerEnhancers){
    return Array.isArray(reducerEnhancers) ? compose(...reducerEnhancers)(reducer) : reducerEnhancers(reducer);
  }
  return reducer;
}
```
Now you get an enhanced reducer only where you want it. Neat.

To see how it all comes together, check out https://github.com/mattkrick/meatier.
