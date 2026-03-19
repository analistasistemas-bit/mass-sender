const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveChatIdForPhone } = require('../lib/recipient-resolver');

test('resolveChatIdForPhone prefers serialized wid', async () => {
  const client = {
    async getNumberId() {
      return { _serialized: '123456@lid' };
    },
  };

  const result = await resolveChatIdForPhone(client, '5581999999999');
  assert.equal(result, '123456@lid');
});

test('resolveChatIdForPhone accepts string ids', async () => {
  const client = {
    async getNumberId() {
      return '123456@lid';
    },
  };

  const result = await resolveChatIdForPhone(client, '5581999999999');
  assert.equal(result, '123456@lid');
});

test('resolveChatIdForPhone falls back to c.us when unresolved', async () => {
  const client = {
    async getNumberId() {
      return null;
    },
  };

  const result = await resolveChatIdForPhone(client, '5581999999999');
  assert.equal(result, '5581999999999@c.us');
});
