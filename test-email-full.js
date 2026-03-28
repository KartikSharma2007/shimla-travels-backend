/**
 * FULL EMAIL TEST — tests every email function the server uses
 * Run from your Backendd folder:
 *   node test-email-full.js
 *
 * This is different from test-email.js — it uses the SAME code
 * as the server, so if this works, the server will work too.
 */

require('dotenv').config();

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

console.log('\n📧 Email System Full Test');
console.log('─────────────────────────');
console.log(`EMAIL_USER = ${user}`);
console.log(`EMAIL_PASS = ${pass ? '[set, ' + pass.replace(/\s/g, '').length + ' chars]' : '[NOT SET ❌]'}`);
console.log(`CLIENT_URL = ${process.env.CLIENT_URL || 'http://localhost:5173 (default)'}`);
console.log('');

if (!user || !pass) {
    console.error('❌ EMAIL_USER or EMAIL_PASS missing in .env — stopping.');
    process.exit(1);
}

const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
});

async function runTests() {
    // ── Test 1: SMTP connection ──────────────────────────────────────────────
    console.log('Test 1: SMTP connection...');
    try {
        const t = createTransporter();
        await t.verify();
        console.log('✅ SMTP connection OK\n');
    } catch (err) {
        console.error('❌ SMTP connection FAILED:', err.message);
        console.error('\n⚠️  Fix: Go to https://myaccount.google.com/apppasswords');
        console.error('   Delete old app password, create a new one, paste it in .env as:');
        console.error('   EMAIL_PASS=xxxx xxxx xxxx xxxx\n');
        process.exit(1);
    }

    // ── Test 2: Booking confirmation email ───────────────────────────────────
    console.log('Test 2: Booking confirmation email...');
    try {
        const t = createTransporter();
        const info = await t.sendMail({
            from: `"Shimla Travels" <${user}>`,
            to: user,
            subject: '✅ TEST: Booking Confirmed — HTL-TEST123',
            text: `Hi Test User,\n\nThis is a TEST booking confirmation email.\nBooking: HTL-TEST123\nHotel: Test Hotel\nCheck-in: 1 April 2026\nCheck-out: 3 April 2026\nTotal Paid: ₹10,000\n\n— Shimla Travels`,
        });
        console.log(`✅ Booking confirmation email sent! MessageId: ${info.messageId}\n`);
    } catch (err) {
        console.error('❌ Booking confirmation email FAILED:', err.message, '\n');
    }

    // ── Test 3: Cancellation email ───────────────────────────────────────────
    console.log('Test 3: Cancellation email...');
    try {
        const t = createTransporter();
        const info = await t.sendMail({
            from: `"Shimla Travels" <${user}>`,
            to: user,
            subject: 'TEST: Booking Cancelled — HTL-TEST123',
            text: `Hi Test User,\n\nThis is a TEST cancellation email.\nBooking HTL-TEST123 has been cancelled.\n\n— Shimla Travels`,
        });
        console.log(`✅ Cancellation email sent! MessageId: ${info.messageId}\n`);
    } catch (err) {
        console.error('❌ Cancellation email FAILED:', err.message, '\n');
    }

    // ── Test 4: Password changed email ───────────────────────────────────────
    console.log('Test 4: Password changed email...');
    try {
        const t = createTransporter();
        const info = await t.sendMail({
            from: `"Shimla Travels" <${user}>`,
            to: user,
            subject: 'TEST: ✅ Your Shimla Travels Password Has Been Changed',
            text: `Hi Test User,\n\nThis is a TEST password-changed email.\nYour password was changed.\n\n— Shimla Travels`,
        });
        console.log(`✅ Password-changed email sent! MessageId: ${info.messageId}\n`);
    } catch (err) {
        console.error('❌ Password-changed email FAILED:', err.message, '\n');
    }

    console.log('─────────────────────────');
    console.log(`✅ All tests done. Check inbox at ${user} for 3 test emails.`);
    console.log('   (Also check spam/junk folder)\n');
}

runTests().catch(err => {
    console.error('Unexpected error:', err.message);
    process.exit(1);
});