async function resolveChatIdForPhone(client, phone) {
  const resolved = await client.getNumberId(phone);
  if (resolved && resolved._serialized) {
    return resolved._serialized;
  }
  if (typeof resolved === 'string' && resolved) {
    return resolved;
  }
  return `${phone}@c.us`;
}

module.exports = {
  resolveChatIdForPhone,
};
