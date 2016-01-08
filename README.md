# redux-optimistic-ui
a reducer enhancer to enable type-agnostic optimistic updates

##Installation
`npm i -S redux-optimistic-ui`

## A what-now?
A reducer enhance is a function you put around a reducer. 
It can be your rootReducer (the output from a `combineReducers`) or a nested one.

## How's it different from redux-optimist?
This project is based heavily on the work of redux-optimist.
redux-optimist is what I'd call a *reducerExtender*. It extends your state with an `optimist`.
`redux-optimistic-ui` wraps your state.
Behind the scenes, it uses immutable.js for a little speed boost.

This has a few advantages:
- Your state doesn't have to be a plain JS Object. You can use an immutable.js `Map` (or whatever the heck else you want, weirdo)
- It's FSA-compliant (if you care about that kinda thing)
- More performant, thanks to immutable.js (although if your queue is long enough to see gains, you're probably doing it wrong).
- If you're really performance driven, you could ignore certain items from going in the queue (eg toggles, css effects, etc.)

The disadvantage is that it wraps your state, so you have to update your references (see how below).

##Usage

###Feed it your reducer

```
import {optimistic} from 'redux-optimistic-ui';
return optimistic(reducer);
```

This will transform your state so it looks like this:
```
wrappedState = Map({
  history: List(),
  current: <YOUR STATE HERE>
})
```

###Update your references to `state`

Since your state is now wrapped, you need `state.get('current')`. 
But that sucks. What if you don't enhance the state until the user hits a certain route?
Lucky you! There's a function for that. `ensureState` will give you your state whether it's enhanced or not.
Just wrap all your references to `state` and `getState` with it & you're all set!

```
import {ensureState} from 'redux-optimistic-ui'
ensureState(getState()).counter // equivalent of getState().counter without the enhancer
```

###Write some middleware

Now comes the fun! Not all of your actions should be optimistic. 
Just the ones that fetch something from a server *and have a high probability of success*.
I like real-world examples, so this middleware is a little bit longer than the bare requirements:

```
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

##Pro tips
Not using an optimistic-ui until a certain route? Using something like `redux-undo` in other parts? Write a little something like this and call it on your asychronous route:

```
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


