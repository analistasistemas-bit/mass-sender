const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isBrowserAlreadyRunningError,
  parsePgrepOutput,
  clearChromiumLockFiles,
  releaseSessionBrowserLock,
} = require('../lib/process-guard');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('detects browser already running error', () => {
  assert.equal(
    isBrowserAlreadyRunningError(new Error('The browser is already running for /tmp/foo. Use a different userDataDir')),
    true,
  );
  assert.equal(isBrowserAlreadyRunningError(new Error('other failure')), false);
});

test('parses only pids for exact session userDataDir', () => {
  const userDataDir = '/Users/mac/Desktop/IA/mass-sender/wa-bridge/.wwebjs_auth/session-mass-sender';
  const otherDir = '/tmp/other';
  const output = [
    `43405 /path/Google Chrome for Testing --user-data-dir=${userDataDir} --headless=new`,
    `43414 /path/Google Chrome for Testing Helper --user-data-dir=${userDataDir}`,
    `77777 /path/Google Chrome for Testing --user-data-dir=${otherDir}`,
    `bad-line-without-pid`,
  ].join('\n');

  assert.deepEqual(parsePgrepOutput(output, userDataDir), [43405, 43414]);
});

test('clears chromium singleton lock files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-lock-'));
  fs.writeFileSync(path.join(dir, 'SingletonLock'), 'x');
  fs.writeFileSync(path.join(dir, 'SingletonCookie'), 'x');

  const removed = clearChromiumLockFiles(dir);

  assert.deepEqual(removed.sort(), ['SingletonCookie', 'SingletonLock']);
  assert.equal(fs.existsSync(path.join(dir, 'SingletonLock')), false);
  assert.equal(fs.existsSync(path.join(dir, 'SingletonCookie')), false);
});

test('releaseSessionBrowserLock removes lock files even without pids', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-lock-empty-'));
  fs.writeFileSync(path.join(dir, 'SingletonLock'), 'x');

  const fakeRunner = async () => {
    const err = new Error('no process');
    err.stdout = '';
    throw err;
  };

  const result = await releaseSessionBrowserLock(dir, { runner: fakeRunner });

  assert.deepEqual(result.killed, []);
  assert.deepEqual(result.remaining, []);
  assert.equal(result.removedLockFiles.includes('SingletonLock'), true);
  assert.equal(fs.existsSync(path.join(dir, 'SingletonLock')), false);
});
