# xmlbind-ts

[![CI](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/neumaennl/xmlbind-ts/actions/workflows/ci.yml)

JAXB-like XML binding for TypeScript.

## Version 3 in development

This branch holds version 3, which is reimplemented in parts ([#299](https://github.com/neumaennl/xmlbind-ts/issues/299)). The code of 2.x is removed, and version 3 cannot be used yet. [ADR 001](docs/architecture/001-reimplementation.md) explains why xmlbind-ts is reimplemented, the principles of version 3 and its parts.

The released version is 2.4.0. Its [README](https://github.com/neumaennl/xmlbind-ts/blob/2.4.0/README.md) describes how to install and use it, and its [documentation](https://github.com/neumaennl/xmlbind-ts/blob/2.4.0/docs/index.md) describes the decorators, marshalling and the generator.

## Documentation

The documentation is in [`docs/`](docs/index.md):

- [ADR 001](docs/architecture/001-reimplementation.md): the reimplementation as version 3
- [Architecture](docs/architecture.md): what xmlbind-ts is responsible for and what belongs to the application
- [Known issues](docs/known-issues.md): the problems of 2.x, which are requirements of version 3

The [changelog](CHANGELOG.md) lists the changes of each version.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) describes the development setup, the checks and how pull requests are reviewed.

## License

GPL-3.0-only
