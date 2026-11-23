import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { publicContactRouter } from '../routes/publicContactRoutes.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/contact', publicContactRouter);
  return app;
}

test('POST /api/public/contact rejects empty or invalid inputs', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/public/contact`;

  try {
    // Missing name
    const res1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', message: 'Das ist eine Testnachricht' })
    });
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.equal(body1.code, 'INVALID_NAME');

    // Invalid email
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Max Mustermann', email: 'keine-email', message: 'Das ist eine Testnachricht' })
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.code, 'INVALID_EMAIL');

    // Too short message
    const res3 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Max Mustermann', email: 'max@example.com', message: 'Hi' })
    });
    assert.equal(res3.status, 400);
    const body3 = await res3.json();
    assert.equal(body3.code, 'INVALID_MESSAGE');
  } finally {
    server.close();
  }
});
