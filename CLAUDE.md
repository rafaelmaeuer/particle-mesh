# CLAUDE.md

## Purpose

This project exists to keep a Particle Mesh network recoverable after the official deprecation of Gen3 mesh support. The primary use case is re-joining an Argon to a Particle Mesh network after `particle-cli` 2.13.0 removed the `mesh` commands and the supported cloud tooling no longer offers the original workflow.

`particle-cli` 2.12.0 is the last version with the `mesh` command; it is removed from 2.13.0 on (`dist/cmd/mesh.js` is missing there). There is no application code, only the dependencies and a wrapper symlink. The repo intentionally holds on to this last compatible CLI so the USB-based rejoin path can still be used for legacy Argon devices.

## Layout

- `package.json`: `particle-cli` exactly `2.12.0`, `particle-usb` `^1.2.1`
- `package-lock.json`: authoritative, install with `npm ci`
- `particle`: symlink to `./node_modules/.bin/particle` (points to `node_modules/particle-cli/dist/index.js`)
- Mesh implementation for reference: `node_modules/particle-cli/dist/cmd/mesh.js`

## Rules

- Never upgrade `particle-cli`, never set a range (`^`, `~`), no `npm update`, no `npm install particle-cli@latest`, no `particle update-cli`.
- Always invoke the CLI via `./particle`, not a global `particle`. A global one is likely newer and has no `mesh`.
- After changing dependencies, check: `./particle --version` must print `2.12.0` and `./particle mesh --help` must list `create add remove list info scan`.
- Run commands that modify devices or networks (`mesh create/add/remove`, `flash`, `keys`, `usb dfu`) only after asking.
- Write all documents in English.

## Environment

- Tested with Node v24.14.0 (the CLI requires `node >= 8`).
- macOS. USB access goes through `particle-usb`.
