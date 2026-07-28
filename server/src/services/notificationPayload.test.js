import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRealtimeNotificationPayload } from './notificationPayload.js';

test('buildRealtimeNotificationPayload includes type and sender for follow requests', () => {
  const payload = buildRealtimeNotificationPayload(
    {
      id: 'notif-1',
      type: 'FOLLOW_REQUEST',
      senderId: 'user-1',
      receiverId: 'user-2',
      isRead: false,
      toJSON: () => ({
        id: 'notif-1',
        type: 'FOLLOW_REQUEST',
        senderId: 'user-1',
        receiverId: 'user-2',
        isRead: false
      })
    },
    {
      id: 'user-1',
      name: 'Alice',
      username: 'alice',
      profilePhoto: 'https://cdn.example.com/alice.jpg'
    }
  );

  assert.equal(payload.type, 'FOLLOW_REQUEST');
  assert.deepEqual(payload.sender, {
    id: 'user-1',
    name: 'Alice',
    username: 'alice',
    profilePhoto: 'https://cdn.example.com/alice.jpg'
  });
});

test('buildRealtimeNotificationPayload includes type and sender for doodle requests', () => {
  const payload = buildRealtimeNotificationPayload(
    {
      id: 'notif-2',
      type: 'DOODLE_REQUEST',
      senderId: 'user-3',
      receiverId: 'user-2',
      doodleRequestId: 'req-7',
      isRead: false,
      toJSON: () => ({
        id: 'notif-2',
        type: 'DOODLE_REQUEST',
        senderId: 'user-3',
        receiverId: 'user-2',
        doodleRequestId: 'req-7',
        isRead: false
      })
    },
    {
      id: 'user-3',
      name: 'Bob',
      username: 'bob',
      profilePhoto: 'https://cdn.example.com/bob.jpg'
    }
  );

  assert.equal(payload.type, 'DOODLE_REQUEST');
  assert.equal(payload.doodleRequestId, 'req-7');
  assert.deepEqual(payload.sender, {
    id: 'user-3',
    name: 'Bob',
    username: 'bob',
    profilePhoto: 'https://cdn.example.com/bob.jpg'
  });
});
