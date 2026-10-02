#!/usr/bin/env node
// Join a device to the mesh network of an assisting device over USB only.
// Same device sequence as `particle mesh add`, but without the cloud
// membership check and cloud registration. Use it when the cloud still lists
// the joiner as a network member but the device lost its credentials locally.
//
// Usage: node scripts/mesh-join-usb.js <joiner_device_id> <assisting_device_id>
// Both devices must be connected via USB. Logs every step, including the
// USB protocol trace from particle-usb.
'use strict';

if (process.versions.node.split('.')[0] !== '16') {
  console.error(`Error: Node v16 required, running ${process.version}. Run: nvm install 16 && nvm use 16`);
  process.exit(1);
}

// Use the particle-usb bundled with particle-cli 2.12.0, which resolves to the
// usb 1.6.3 native module the CLI uses. The top-level particle-usb resolves to
// usb 1.9.2, whose control transfers time out against these devices.
const usb = require('../node_modules/particle-cli/node_modules/particle-usb');

const startedAt = Date.now();

function log(level, msg) {
  const ts = new Date().toISOString();
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(3).padStart(8);
  const line = `${ts} +${elapsed}s ${level.padEnd(5)} ${msg}`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(line);
  } else {
    console.log(line);
  }
}

usb.config({
  log: {
    trace: (msg) => log('TRACE', `[usb] ${msg}`),
    info: (msg) => log('INFO', `[usb] ${msg}`),
    warn: (msg) => log('WARN', `[usb] ${msg}`),
    error: (msg) => log('ERROR', `[usb] ${msg}`)
  }
});

// Run one step, log start, duration and result or failure.
async function step(name, fn) {
  log('STEP', `${name} ...`);
  const t0 = Date.now();
  try {
    const result = await fn();
    log('STEP', `${name} OK (${Date.now() - t0} ms)`);
    return result;
  } catch (err) {
    log('ERROR', `${name} FAILED after ${Date.now() - t0} ms`);
    err.step = err.step || name;
    throw err;
  }
}

function describeDevice(dev) {
  return `type=${dev.type} platformId=${dev.platformId} id=${dev.id || '?'} ` +
    `firmware=${dev.firmwareVersion || '?'} dfu=${dev.isInDfuMode} mesh=${dev.isMeshDevice}`;
}

async function logDeviceState(label, dev) {
  log('INFO', `${label}: ${describeDevice(dev)}`);
  try {
    log('INFO', `${label}: mode=${await dev.getDeviceMode()}`);
  } catch (err) {
    log('WARN', `${label}: unable to get device mode: ${err.message}`);
  }
}

function logNetwork(label, network) {
  if (!network) {
    log('INFO', `${label}: not a member of any mesh network`);
    return;
  }
  log('INFO', `${label}: network name=${network.name} id=${network.id} channel=${network.channel} ` +
    `panId=${network.panId} extPanId=${network.extPanId}`);
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('A TTY is required to enter the password'));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (ch === '\u0003') {
        stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(130);
      } else if (ch === '\u007f') {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const [joinerId, assistId] = process.argv.slice(2);
  if (!joinerId || !assistId) {
    console.error('Usage: node scripts/mesh-join-usb.js <joiner_device_id> <assisting_device_id>');
    process.exit(1);
  }

  log('INFO', `node=${process.version} platform=${process.platform} arch=${process.arch}`);
  log('INFO', `particle-usb=${require.resolve('../node_modules/particle-cli/node_modules/particle-usb')}`);
  log('INFO', `usb=${require.resolve('usb', { paths: [require.resolve('../node_modules/particle-cli/node_modules/particle-usb')] })}`);
  log('INFO', `joiner=${joinerId} assisting=${assistId}`);

  const found = await step('List USB devices', () => usb.getDevices());
  log('INFO', `Found ${found.length} Particle USB device(s)`);
  found.forEach((dev, i) => {
    log('INFO', `  [${i}] type=${dev.type} platformId=${dev.platformId} dfu=${dev.isInDfuMode}`);
  });
  if (found.some((dev) => dev.isInDfuMode)) {
    log('WARN', 'At least one device is in DFU mode (blinking yellow). Mesh requests do not work in DFU mode.');
  }

  let joiner = null;
  let assist = null;
  let commissioning = false;
  try {
    assist = await step('Open assisting device', () => usb.openDeviceById(assistId));
    await logDeviceState('Assisting', assist);
    joiner = await step('Open joiner device', () => usb.openDeviceById(joinerId));
    await logDeviceState('Joiner', joiner);
    if (!assist.isMeshDevice || !joiner.isMeshDevice) {
      throw new Error('Both devices must support mesh networking');
    }

    const network = await step('Get network info from assisting device', () => assist.getMeshNetworkInfo());
    logNetwork('Assisting', network);
    if (!network) {
      throw new Error('The assisting device is not a member of any mesh network');
    }

    const current = await step('Get network info from joiner device', () => joiner.getMeshNetworkInfo());
    logNetwork('Joiner', current);
    if (current) {
      log('INFO', `Joiner is already a member of ${current.name}. Nothing to do.`);
      return;
    }

    const password = await promptHidden('Enter the network password: ');
    log('INFO', `Password entered (${password.length} characters)`);

    await step('Authenticate on assisting device (meshAuth)', () => assist.meshAuth(password));
    await step('Start commissioner on assisting device', () => assist.startCommissioner());
    commissioning = true;

    await step('Join network (prepareJoiner, addJoiner, joinNetwork)', () => joiner.joinMeshNetwork(assist));
    await logDeviceState('Joiner', joiner);

    await step('Stop commissioner on assisting device', () => assist.stopCommissioner());
    commissioning = false;

    const joined = await step('Get network info from joiner device', () => joiner.getMeshNetworkInfo());
    logNetwork('Joiner', joined);
    if (!joined) {
      log('WARN', 'Joiner reports no network after joining.');
    }

    await step('Leave listening mode on joiner device', () => joiner.leaveListeningMode());
    log('INFO', 'Done. The device should now connect to the cloud.');
  } finally {
    if (commissioning) {
      await step('Stop commissioner on assisting device (cleanup)', () => assist.stopCommissioner()).catch(() => {});
    }
    if (joiner) {
      await step('Close joiner device', () => joiner.close()).catch(() => {});
    }
    if (assist) {
      await step('Close assisting device', () => assist.close()).catch(() => {});
    }
  }
}

main().catch((err) => {
  log('ERROR', `${err.name || 'Error'}: ${err.message}`);
  if (err.step) {
    log('ERROR', `Failed step: ${err.step}`);
  }
  for (const key of ['result', 'code', 'errno', 'status']) {
    if (err[key] !== undefined) {
      log('ERROR', `${key}: ${err[key]}`);
    }
  }
  if (err.stack) {
    console.error(err.stack);
  }
  if (/TIMED_OUT|timeout/i.test(err.message)) {
    log('ERROR', 'Hint: USB request timed out. A previous aborted run can leave the devices unresponsive on USB. ' +
      'Unplug and replug both devices (directly, no hub), make sure no other tool (particle serial monitor, ' +
      'Workbench) holds the USB port, and retry.');
  }
  process.exit(1);
});
