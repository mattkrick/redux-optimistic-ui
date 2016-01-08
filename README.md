# redux-optimistic-ui
a reducer enhancer to enable type-agnostic optimistic updates

##Installation
`npm i -S redux-optimistic-ui`

## A what-now?
A reducer enhance is a function you put around a reducer. 
It can be your rootReducer (the output from a `combineReducers`) or a nested one.

## How's it different from redux-optimist?
redux-optimist is what I'd call a *reducerExtender*. It extends your reducers with an `optimist`.
`redux-optimistic-ui` wraps your state. 
Behind the scenes, it also uses `immutable`.

This has a few advantages:
- You can use `immutable` (or whatever the heck else you want, weirdo)
- More performant, thanks to `immutable` (although if your queue is long enough to see gains, you're probably doing it wrong).
- If you're really performance driven, you could ignore certain items from going in the queue (eg toggles, css effects, etc.)

##Usage
Here's how your state will look
```
wrappedState = Map({
  history: List(),
  current: <YOUR STATE HERE>
})
```
*Note: this means you gotta update your references from `state` to `state.get('current')`*

...to be continued
