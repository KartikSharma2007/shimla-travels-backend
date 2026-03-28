/**
 * QUICK EMAIL TEST — run this AFTER updating EMAIL_PASS in .env
 * 
 * From your Backendd folder, run:
 *   node test-email.js
 * 
 * You should see: "✅ Test email sent successfully!"
 * If you see an error, your App Password is still wrong.
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

console.log('\n📧 Testing Gmail SMTP...');
console.log(`   EMAIL_USER = ${user}`);
console.log(`   EMAIL_PASS = ${pass ? '[set, length=' + pass.replace(/\s/g, '').length + ']' : '[NOT SET]'}`);

if (!user || !pass) {
    console.error('\n❌ EMAIL_USER or EMAIL_PASS is missing in .env');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
});

(async () => {
    try {
        await transporter.verify();
        console.log('\n✅ SMTP connection verified! Sending test email...');

        const info = await transporter.sendMail({
            from: `"Shimla Travels Test" <${user}>`,
            to: user,               // sends to yourself
            subject: '✅ Email Test — Shimla Travels',
            text: 'If you see this, your Gmail App Password is working correctly!',
        });

        console.log(`✅ Test email sent! MessageId: ${info.messageId}`);
        console.log(`\n👉 Check your inbox at ${user} for the test email.\n`);
    } catch (err) {
        console.error('\n❌ FAILED:', err.message);
        if (err.message.includes('535') || err.message.includes('BadCredentials')) {
            console.error('\n⚠️  Your App Password is WRONG or EXPIRED.');
            console.error('   → Go to: https://myaccount.google.com/apppasswords');
            console.error('   → Delete the old "Shimla Travels" app password');
            console.error('   → Click "Create app password", name it "Shimla Travels"');
            console.error('   → Copy the 16-character password (ignore spaces)');
            console.error('   → Paste it into .env as: EMAIL_PASS=xxxx xxxx xxxx xxxx');
        }
        process.exit(1);
    }
})();
