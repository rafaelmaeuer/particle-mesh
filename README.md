# Particle CLI 2.12.0

Local install of Particle CLI **2.12.0**, the last version with the `particle mesh` commands.
Particle deprecated Mesh (Thread) for Gen3 devices (Argon, Boron, Xenon). Starting with `particle-cli` 2.13.0 the `mesh` command is removed.

## Setup

```sh
npm ci                 # installs the exact versions from package-lock.json
./particle --version   # -> 2.12.0
```

`./particle` is a symlink to `node_modules/.bin/particle`, so this version does not clash with a newer, globally installed CLI.

## Login

The mesh commands need a logged-in CLI: `list`, `create`, `add` and `remove` call the Particle Cloud API, and `info` and `scan` use it to resolve device names to IDs.

```sh
./particle login                   # prompts for email, password and 2FA code
./particle login --token <token>   # or use an existing access token
./particle whoami                  # check the login
```

The token is stored in `~/.particle/particle.config.json`, so the login is shared with any other Particle CLI on the machine.

## Mesh commands

```sh
./particle mesh list               # networks and their member devices
./particle mesh info               # network of the device connected via USB
./particle mesh scan               # networks in range
./particle mesh create <name>      # new network (device via USB)
./particle mesh add <new> <assist> # add a device
./particle mesh remove <device>    # remove a device
./particle help mesh <command>     # details
```

## Rejoin a device without the cloud check

`./particle mesh add` refuses to run if the cloud still lists the joiner as a network member, even when the device lost its network credentials locally. `scripts/mesh-join-usb.js` runs the same device sequence over USB only, without cloud calls. Connect both devices via USB, then:

```sh
nvm install 16
nvm use 16
node scripts/mesh-join-usb.js <joiner_device_id> <assisting_device_id>
./particle mesh info <joiner_device_id>   # verify
```

The script aborts if it is not running on Node v16. It does not need a login because it talks to the devices only, but the verify step with `./particle mesh info` does.

## Troubleshooting

`IN control transfer failed: LIBUSB_TRANSFER_TIMED_OUT`: the device is visible on USB but does not answer requests. An aborted script or CLI run can leave it in this state, and every following call times out, including `./particle mesh info`. Unplug and replug the device, then retry.

## Important

- `particle-cli` is pinned to exactly `2.12.0` in `package.json`. Do not use `^`/`~` and do not run `npm update`, otherwise a version without mesh gets installed.
- Do not run `particle update-cli`.
- `particle-usb` (1.2.1) is needed for the USB communication of the mesh commands.
- The mesh commands use the Particle Cloud API. Whether they still work depends on Particle still serving the mesh endpoints.
