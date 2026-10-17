import assert from "node:assert/strict";
import { test } from "node:test";

await (await import("./test-db.ts")).useTestDatabase();
const { closeAllSessions, closeSession, openSession, sessionIsLive } = await import("./session-store.ts");

const ALICE = "did:privy:alice";
const BOB = "did:privy:bob";

test("a session is live for its own user until it is closed", async () => {
  const id = await openSession(ALICE, 60);
  assert.equal(await sessionIsLive(id, ALICE), true);
  assert.equal(await sessionIsLive(id, BOB), false);
  await closeSession(id);
  assert.equal(await sessionIsLive(id, ALICE), false);
});

test("an expired session is dead", async () => {
  assert.equal(await sessionIsLive(await openSession(ALICE, -1), ALICE), false);
});

test("signing out everywhere ends every session of that user only", async () => {
  const laptop = await openSession(ALICE, 60);
  const phone = await openSession(ALICE, 60);
  const bob = await openSession(BOB, 60);
  assert.equal(await closeAllSessions(ALICE), 2);
  assert.equal((await sessionIsLive(laptop, ALICE)) || (await sessionIsLive(phone, ALICE)), false);
  assert.equal(await sessionIsLive(bob, BOB), true);
});
