# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- provide a Browserified distribution in the `dist` directory of the published npm module

## [3.0.0] - 2017-08-03
### Changed
- remove dependency on ImmutableJs (#30)

### Fixes
- fix interoperability with Redux DevTools (#36)

## [2.1.0] - 2017-07-28
### Fixes
- correctly handle invalid transaction ids (#32)

## [2.0.0] - 2017-06-23
### Fixes
- fix error with non-root optimistic reducer and `initialState` (#22)

## 1.0.0 - 2017-02-17

[Unreleased]: https://github.com/mattkrick/redux-optimistic-ui/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/mattkrick/redux-optimistic-ui/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/mattkrick/redux-optimistic-ui/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/mattkrick/redux-optimistic-ui/compare/v1.0.0...HEAD