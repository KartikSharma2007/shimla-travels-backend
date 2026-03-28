/**
 * DIAGNOSIS SCRIPT — run this on your Render server shell
 * 
 * In Render dashboard → your backend service → Shell tab
 * Type:  node diagnose.js
 * 
 * This shows EXACTLY what environment variables Render has
 * and whether email works FROM RENDER (not your local machine)
 */

require('dotenv').config();

const nodemailer = require('nodemailer');

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  RENDER ENVIRONMENT DIAGNOSIS');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('── Email Environment Variables ──────────────────────────────');
console.log('  EMAIL_USER  =', process.env.EMAIL_USER || '❌ NOT SET — THIS IS THE PROBLEM');
console.log('  EMAIL_PASS  =', process.env.EMAIL_PASS
    ? `✅ set — value is: [${process.env.EMAIL_PASS}]`
    : '❌ NOT SET — THIS IS THE PROBLEM');
console.log('  EMAIL_FROM  =', process.env.EMAIL_FROM || '❌ NOT SET');
console.log('  SUPPORT_EMAIL =', process.env.SUPPORT_EMAIL || '❌ NOT SET');
console.log('');
console.log('── Other Key Variables ──────────────────────────────────────');
console.log('  NODE_ENV    =', process.env.NODE_ENV || '❌ NOT SET');
console.log('  PORT        =', process.env.PORT || '❌ NOT SET');
console.log('  CLIENT_URL  =', process.env.CLIENT_URL || '❌ NOT SET');
console.log('');

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

if (!user || !pass) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ❌ CANNOT TEST — EMAIL_USER or EMAIL_PASS is missing!');
    console.log('');
    console.log('  FIX: Go to Render Dashboard → your backend service');
    console.log('       → Environment tab → Add these variables:');
    console.log('       EMAIL_USER  = shimlaatravels@gmail.com');
    console.log('       EMAIL_PASS  = your 16-char Gmail App Password');
    console.log('═══════════════════════════════════════════════════════════════');
    process.exit(1);
}

console.log('── Attempting to send test email FROM RENDER ─────────────────');
console.log(`  FROM: ${user}`);
console.log(`  TO:   ${user}  (self-test)`);
console.log('  Connecting to smtp.gmail.com:587 ...');
console.log('');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
});

transporter.sendMail({
    from: `"Render Diagnosis" <${user}>`,
    to: user,
    subject: `✅ Render Email Test — ${new Date().toLocaleTimeString('en-IN')}`,
    text: `This email was sent FROM RENDER successfully.\n\nEMAIL_USER: ${user}\nTime: ${new Date().toString()}`,
}).then(info => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ SUCCESS! Email sent from Render!');
    console.log(`  MessageId: ${info.messageId}`);
    console.log(`  Response:  ${info.response}`);
    console.log('');
    console.log('  Email configuration on Render is WORKING.');
    console.log('  If booking emails still don\'t arrive, check the user\'s SPAM folder.');
    console.log('═══════════════════════════════════════════════════════════════');
}).catch(err => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ❌ FAILED! This is why booking emails don\'t work!');
    console.log('');
    console.log('  Error:', err.message);
    console.log('  Code: ', err.code || 'none');
    console.log('  Response:', err.response || 'none');
    console.log('');
    if (err.message.includes('535') || err.message.includes('BadCredentials')) {
        console.log('  ⚠️  CAUSE: EMAIL_PASS on Render is WRONG or EXPIRED');
        console.log('  FIX:');
        console.log('    1. Go to https://myaccount.google.com/apppasswords');
        console.log('       (logged in as shimlaatravels@gmail.com)');
        console.log('    2. Delete the old app password');
        console.log('    3. Create a new one — name it "Shimla Travels Render"');
        console.log('    4. Copy the 16 chars (e.g. abcd efgh ijkl mnop)');
        console.log('    5. In Render dashboard → Environment → update EMAIL_PASS');
        console.log('    6. Render will restart automatically');
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
        console.log('  ⚠️  CAUSE: Render cannot reach smtp.gmail.com');
        console.log('  FIX: Render free tier blocks outbound SMTP on port 587');
        console.log('       Upgrade Render plan, OR use a different email service');
        console.log('       like SendGrid or Resend (both have free tiers)');
    }
    console.log('═══════════════════════════════════════════════════════════════');
});