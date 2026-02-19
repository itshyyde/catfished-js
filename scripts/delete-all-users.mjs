#!/usr/bin/env node
/**
 * Delete all users from Firebase Authentication.
 *
 * Usage:
 *   source .env.local && FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID node scripts/delete-all-users.mjs
 *
 * Requires: npm install firebase-admin
 * Requires: npx firebase login (must be logged in)
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!PROJECT_ID) {
    console.error('❌ Set FIREBASE_PROJECT_ID env variable.');
    process.exit(1);
}

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);

async function deleteAllUsers(nextPageToken) {
    const listResult = await auth.listUsers(1000, nextPageToken);
    const uids = listResult.users.map(u => u.uid);

    if (uids.length === 0) {
        console.log('✅ No more users to delete.');
        return 0;
    }

    console.log(`🗑️  Deleting batch of ${uids.length} users...`);
    const result = await auth.deleteUsers(uids);
    console.log(`   Deleted: ${result.successCount}, Failed: ${result.failureCount}`);

    if (result.failureCount > 0) {
        result.errors.forEach(e => console.error(`   Error: ${e.error.message}`));
    }

    let totalDeleted = result.successCount;

    if (listResult.pageToken) {
        totalDeleted += await deleteAllUsers(listResult.pageToken);
    }

    return totalDeleted;
}

console.log(`🔥 Deleting all users from project: ${PROJECT_ID}`);
const total = await deleteAllUsers();
console.log(`\n✅ Done. ${total} users deleted.`);
process.exit(0);
