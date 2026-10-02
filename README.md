# Particle CLI 2.12.0

Local install of Particle CLI **2.12.0**, the last version with the `particle mesh` commands.
Particle deprecated Mesh (Thread) for Gen3 devices (Argon, Boron, Xenon). Starting with `particle-cli` 2.13.0 the `mesh` command is removed.

## Setup

```sh
npm ci                 # installs the exact versions from package-lock.json
./particle --version   # -> 2.12.0
```

`./particle` is a symlink to `node_modules/.bin/particle`, so this version does not clash with a newer, globally installed CLI.

## Mesh commands

```sh
./particle login
./particle mesh list               # networks and their member devices
./particle mesh info               # network of the device connected via USB
./particle mesh scan               # networks in range
./particle mesh create <name>      # new network (device via USB)
./particle mesh add <new> <assist> # add a device
./particle mesh remove <device>    # remove a device
./particle help mesh <command>     # details
```

## Important

- `particle-cli` is pinned to exactly `2.12.0` in `package.json`. Do not use `^`/`~` and do not run `npm update`, otherwise a version without mesh gets installed.
- Do not run `particle update-cli`.
- `particle-usb` (1.2.1) is needed for the USB communication of the mesh commands.
- The mesh commands use the Particle Cloud API. Whether they still work depends on Particle still serving the mesh endpoints.
