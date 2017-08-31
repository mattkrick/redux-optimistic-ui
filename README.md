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

### Write some middleware

Now comes the fun! Not all of your actions should be optimistic.
Just the ones that fetch something from a server *and have a high probability of success*.
I like real-world examples, so this middleware is a little bit longer than the bare requirements:

```js
import {BEGIN, COMMIT, REVERT} from 'redux-optimistic-ui';

//All my redux action types that are optimistic have the following suffixes, yours may vary
const _SUCCESS = '_SUCCESS';
const _ERROR = '_ERROR';

//Each optimistic item will need a transaction Id to internally match the BEGIN to the COMMIT/REVERT
let nextTransactionID = 0;

// That crazy redux middleware that's 3 functions deep!
export default store => next => action => {
  // FSA compliant
  const {type, meta, payload} = action;

  // For actions that have a high probability of failing, I don't set the flag
  if (!meta || !meta.isOptimistic) return next(action);

  // Now that we know we're optimistically updating the item, give it an ID
  let transactionID = nextTransactionID++;

  // Extend the action.meta to let it know we're beginning an optimistic update
  next(Object.assign({}, action, {meta: {optimistic: {type: BEGIN, id: transactionID}}}));

  // HTTP is boring, I like sending data over sockets, the 3rd arg is a callback
  socket.emit(type, payload, error => {
    // Create a redux action based on the result of the callback
    next({
      type: type + (error ? _ERROR : _SUCCESS),
      error,
      payload,
      meta: {
        //Here's the magic: if there was an error, revert the state, otherwise, commit it
        optimistic: error ? {type: REVERT, id: transactionID} : {type: COMMIT, id: transactionID}
      }
    });
  })
};
```

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
