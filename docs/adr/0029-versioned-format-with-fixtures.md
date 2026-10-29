# 29. Versioned save format with migrations and permanent fixtures

The save format carries an integer `version`. Every format change bumps it and adds a pure migration from the previous version. Each past version keeps a fixture file that tests must load forever; old schemas are never edited.
