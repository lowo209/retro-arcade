import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { controlsForGame, defaultControls } from '../public/catalog.js';

test('keyboard players have no shared or duplicate gameplay keys', () => {
  for (const id of ['umk3', 'nfs', 'gt2', 're3', 'ac3', 'gits', 'gpolice2']) {
    const defaults = defaultControls(id);
    const keys = [0, 1].flatMap(player => Object.values(defaults[player]).map(control => control.value).filter(Boolean));
    assert.equal(new Set(keys).size, keys.length, `${id}: one key must not drive two inputs or players`);
    assert.ok(Object.values(defaults[2]).every(control => control.value === ''));
    assert.ok(Object.values(defaults[3]).every(control => control.value === ''));
  }
});

test('gamepad mapping survives keyboard profiles and profile objects are independent', () => {
  const normal = defaultControls('re3');
  const racing = defaultControls('nfs');
  for (let player = 0; player < 4; player++) {
    for (const slot of Object.keys(normal[player])) {
      assert.equal(racing[player][slot].value2, normal[player][slot].value2);
    }
  }
  normal[0][4].value = 'changed';
  assert.equal(defaultControls('re3')[0][4].value, 'w');
  assert.equal(defaultControls('nfs')[0][0].value, 'w');
  assert.equal(defaultControls('nfs')[0][1].value, 's');
  assert.deepEqual(controlsForGame('gt2'), controlsForGame('nfs'));
});

test('keyboard names are understood by the pinned EmulatorJS runtime', { skip: !fs.existsSync(new URL('../vendor/emulatorjs/data/src/emulator.js', import.meta.url)) }, () => {
  const source = fs.readFileSync(new URL('../vendor/emulatorjs/data/src/emulator.js', import.meta.url), 'utf8');
  const keyMap = source.slice(source.indexOf('this.keyMap = {'), source.indexOf('    setupKeys()'));
  const supported = new Set([...keyMap.matchAll(/\d+:\s*"([^"]*)"/g)].map(match => match[1]));
  for (const id of ['umk3', 'nfs', 'gt2', 're3', 'ac3', 'gits', 'gpolice2']) {
    for (const control of controlsForGame(id)) {
      assert.ok(supported.has(control.p1), `${id}: unknown keyboard name ${control.p1}`);
      assert.ok(supported.has(control.p2), `${id}: unknown keyboard name ${control.p2}`);
    }
  }
});
