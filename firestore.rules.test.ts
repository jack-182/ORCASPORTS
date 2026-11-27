/**
 * Firestore Security Rules Test Specification (Dirty Dozen Adversarial Suite)
 * Run against Firebase Emulator Suite when verifying rules locally.
 */
export interface DirtyDozenCase {
  id: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    collection: 'users/u1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Shadow update / self-verification elevation on user creation',
    payload: { uid: 'u1', verified: true, isAdmin: true },
  },
  {
    id: 'DD-02',
    collection: 'events/evt1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Identity spoofing by setting hostId to another user',
    payload: { id: 'evt1', hostId: 'victim_uid', title: 'Pelada Spoof' },
  },
  {
    id: 'DD-03',
    collection: `events/${'a'.repeat(200)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Path variable ID poisoning exceeding 128 chars',
  },
  {
    id: 'DD-04',
    collection: 'users_private/victim_uid',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'PII read attempt by non-owner authenticated user',
  },
  {
    id: 'DD-05',
    collection: 'events/evt2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Write attempt with email_verified == false',
  },
  {
    id: 'DD-06',
    collection: 'events/evt3',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Client timestamp forgery not matching request.time',
  },
  {
    id: 'DD-07',
    collection: 'events/cancelled_evt',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Terminal state mutation on cancelled/completed event',
  },
  {
    id: 'DD-08',
    collection: 'conversations/private_c1/messages/m1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Non-member message injection bypassed Master Gate',
  },
  {
    id: 'DD-09',
    collection: 'conversations',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Unfiltered list query attempting to read foreign conversations',
  },
  {
    id: 'DD-10',
    collection: 'conversations/c1/messages/m2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Oversized message text payload exceeding 1000 chars',
    payload: { text: 'x'.repeat(2500) },
  },
  {
    id: 'DD-11',
    collection: 'users/u1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Unbounded favoriteSports array injection (> 8 items)',
    payload: { favoriteSports: Array.from({ length: 15 }, (_, i) => `Sport${i}`) },
  },
  {
    id: 'DD-12',
    collection: 'notifications/n1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Reading notification belonging to another recipientId',
  },
];
