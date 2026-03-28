htmlContent: `
  <div style="text-align:center;">
    <img src="https://shimla-travels.netlify.app/logo.png" 
         alt="Shimla Travels" 
         width="120"
         style="margin-bottom:20px;" />
  </div>

  <h2>Booking Confirmed ✅</h2>
  <p>Hello ${name},</p>
`
/**
 * emailService.js — Shimla Travels
 * Uses Brevo (formerly Sendinblue) HTTP API.
 * No domain verification needed — sends to any email address free.
 * Free tier: 300 emails/day.
 */

const https = require('https');
const logger = require('./logger');

// ─── Send via Brevo API ───────────────────────────────────────────────────────
const brevoSend = (payload) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return reject(new Error('BREVO_API_KEY not set in environment variables'));
    }

    const body = JSON.stringify(payload);

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        } else {
          try {
            const err = JSON.parse(data);
            reject(new Error(`Brevo error ${res.statusCode}: ${err.message || data}`));
          } catch {
            reject(new Error(`Brevo error ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// ─── Core send helper ─────────────────────────────────────────────────────────
const _send = async (label, { to, subject, htmlContent, textContent, replyTo }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = 'shimlaatravels@gmail.com';
  const fromName = 'Shimla Travels';

  console.log(`\n[EMAIL] ========== ${label} ==========`);
  console.log(`[EMAIL] TO      : ${to}`);
  console.log(`[EMAIL] SUBJECT : ${subject}`);
  console.log(`[EMAIL] FROM    : ${fromName} <${fromEmail}>`);
  console.log(`[EMAIL] API_KEY : ${apiKey ? `SET (${apiKey.substring(0, 12)}...)` : 'NOT SET'}`);

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
  };
  if (replyTo) payload.replyTo = { email: replyTo };

  const result = await brevoSend(payload);

  console.log(`[EMAIL] SUCCESS [${label}] → messageId: ${result.messageId || 'sent'}`);
  logger.info(`[EMAIL] ${label} sent to ${to} — ${result.messageId || 'ok'}`);
  return { success: true, messageId: result.messageId };
};

// ─── Startup test ─────────────────────────────────────────────────────────────
const runStartupEmailTest = async () => {
  const apiKey = process.env.BREVO_API_KEY;

  console.log('\n[STARTUP] =====================================================');
  console.log('[STARTUP] EMAIL SERVICE: Brevo (HTTP API)');
  console.log(`[STARTUP] BREVO_API_KEY : ${apiKey ? `SET (${apiKey.substring(0, 12)}...)` : '❌ NOT SET'}`);
  console.log(`[STARTUP] NODE_ENV      : ${process.env.NODE_ENV}`);
  console.log(`[STARTUP] CLIENT_URL    : ${process.env.CLIENT_URL}`);
  console.log('[STARTUP] =====================================================');

  if (!apiKey) {
    console.log('[STARTUP] ❌ BREVO_API_KEY not set — emails will NOT work!');
    console.log('[STARTUP] Add BREVO_API_KEY to Render Environment tab');
    console.log('[STARTUP] =====================================================\n');
    return;
  }

  try {
    await brevoSend({
      sender: { name: 'Shimla Travels', email: 'shimlaatravels@gmail.com' },
      to: [{ email: 'shimlaatravels@gmail.com' }],
      subject: `✅ Shimla Travels Server Started — ${new Date().toISOString()}`,
      textContent: `Server started. Brevo email is working!\nTime: ${new Date().toString()}`,
    });
    console.log('[STARTUP] ✅ TEST EMAIL SENT — Brevo is working!');
    console.log('[STARTUP] ✅ Check shimlaatravels@gmail.com inbox');
    logger.info('[STARTUP] Brevo email test passed');
  } catch (err) {
    console.log(`[STARTUP] ❌ TEST FAILED: ${err.message}`);
    logger.error(`[STARTUP] Brevo test failed: ${err.message}`);
  }

  console.log('[STARTUP] =====================================================\n');
};

// ─── Password Reset ───────────────────────────────────────────────────────────
const sendPasswordResetEmail = async (toEmail, resetToken, userName = 'User') => {
  const clientUrl = process.env.CLIENT_URL || 'https://shimla-travels.netlify.app';
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  return await _send('PASSWORD RESET', {
    to: toEmail,
    subject: '🔐 Reset Your Shimla Travels Password',
    textContent: `Hi ${userName},\n\nReset your password (valid 10 min):\n${resetUrl}\n\nIgnore if you didn't request this.\n\n— Shimla Travels`,
    htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}.h{background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center}.h h1{color:#fff;margin:0;font-size:22px;font-weight:700}.b{padding:40px;color:#2d3748;font-size:15px;line-height:1.7}.btn{display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff!important;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600}.warn{background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;font-size:13px;color:#78350f;margin-top:20px}.f{background:#f7fafc;padding:20px 40px;text-align:center;font-size:12px;color:#718096}</style></head><body><div class="w"><div class="h"><h1>🏔️ Shimla Travels</h1></div><div class="b"><p>Hi <strong>${userName}</strong>,</p><p>Click below to reset your password. Expires in <strong>10 minutes</strong>.</p><p style="text-align:center;margin:28px 0"><a href="${resetUrl}" class="btn">Reset My Password</a></p><p style="font-size:13px;color:#718096">Or copy this link:<br/>${resetUrl}</p><div class="warn">⚠️ Didn't request this? Ignore this email.</div></div><div class="f">© ${new Date().getFullYear()} Shimla Travels</div></div></body></html>`,
  });
};

// ─── Password Changed ─────────────────────────────────────────────────────────
const sendPasswordChangedEmail = async (toEmail, userName = 'User') => {
  try {
    await _send('PASSWORD CHANGED', {
      to: toEmail,
      subject: '✅ Your Shimla Travels Password Has Been Changed',
      textContent: `Hi ${userName},\n\nYour password was changed. If you didn't do this, contact us at shimlaatravels@gmail.com immediately.\n\n— Shimla Travels`,
      htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}.h{background:linear-gradient(135deg,#10b981,#047857);padding:28px 40px;text-align:center}.h h1{color:#fff;margin:0;font-size:20px;font-weight:700}.b{padding:36px 40px;color:#2d3748;font-size:15px;line-height:1.7}.alert{background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;font-size:13px;color:#78350f;margin-top:16px}.f{background:#f7fafc;padding:16px 40px;text-align:center;font-size:12px;color:#718096}</style></head><body><div class="w"><div class="h"><h1>✅ Password Changed</h1></div><div class="b"><p>Hi <strong>${userName}</strong>,</p><p>Your Shimla Travels password was updated successfully.</p><div class="alert">🔒 Didn't do this? Contact: <a href="mailto:shimlaatravels@gmail.com">shimlaatravels@gmail.com</a></div></div><div class="f">© ${new Date().getFullYear()} Shimla Travels</div></div></body></html>`,
    });
  } catch (err) {
    console.error(`[EMAIL] PASSWORD CHANGED failed for ${toEmail}: ${err.message}`);
    logger.error(`[EMAIL] PASSWORD CHANGED failed for ${toEmail}: ${err.message}`);
  }
};

// ─── Booking Confirmation ─────────────────────────────────────────────────────
const sendBookingConfirmationEmail = async (toEmail, userName, booking) => {
  try {
    const isHotel = booking.bookingType === 'hotel';
    const itemName = booking.hotelName || booking.packageTitle || 'Your Booking';
    const amount = booking.pricing?.totalAmount?.toLocaleString('en-IN') || '0';
    const bookingUrl = `${process.env.CLIENT_URL || 'https://shimla-travels.netlify.app'}/account`;
    const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    await _send('BOOKING CONFIRMATION', {
      to: toEmail,
      subject: `✅ Booking Confirmed — ${booking.bookingReference}`,
      textContent: `Hi ${userName},\n\nYour booking ${booking.bookingReference} for ${itemName} is confirmed!\n${isHotel ? `Check-in: ${fmt(booking.checkIn)}\nCheck-out: ${fmt(booking.checkOut)}` : `Travel Date: ${fmt(booking.travelDate)}`}\nTotal Paid: ₹${amount}\n\nView booking: ${bookingUrl}\n\n— Shimla Travels`,

      htmlContent: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}
.h{background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center}
.h h1{color:#fff;margin:0;font-size:22px;font-weight:700}
.h p{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}
.b{padding:36px 40px;color:#2d3748}
.b p{font-size:15px;line-height:1.7;margin:0 0 14px}
.ref-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;text-align:center}
.ref{font-size:24px;font-weight:800;color:#059669;letter-spacing:1.5px}
.tbl{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
.tbl td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
.tbl td:first-child{color:#718096;font-weight:500;width:40%}
.tbl td:last-child{color:#1a202c;font-weight:600}
.amt td{background:#f7fafc}
.cta{text-align:center;margin:28px 0}
.btn{display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff!important;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:15px;font-weight:600}
.note{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;font-size:13px;color:#1e40af;margin-top:16px}
.f{background:#f7fafc;padding:20px 40px;text-align:center;font-size:12px;color:#718096}
</style>
</head>

<body>
<div class="w">

  <!-- ✅ HEADER WITH LOGO -->
  <div class="h">
    <img src="https://shimla-travels.netlify.app/logo.png" 
         width="80" 
         style="margin-bottom:10px; border-radius:8px;" />

    <h1>🏔️ Booking Confirmed!</h1>
    <p>Your Shimla Travels adventure is all set</p>
  </div>

  <div class="b">
    <p>Hi <strong>${userName}</strong>,</p>
    <p>Your booking is <strong>confirmed</strong> and payment received!</p>

    <div class="ref-box">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">
        Booking Reference
      </div>
      <div class="ref">${booking.bookingReference}</div>
    </div>

    <table class="tbl">
      <tr><td>${isHotel ? 'Hotel' : 'Package'}</td><td>${itemName}</td></tr>
      <tr><td>${isHotel ? 'Check-in' : 'Travel Date'}</td><td>${isHotel ? fmt(booking.checkIn) : fmt(booking.travelDate)}</td></tr>
      ${isHotel ? `<tr><td>Check-out</td><td>${fmt(booking.checkOut)}</td></tr>` : ''}
      <tr><td>Guests</td><td>${booking.guests?.adults || 1} Adult(s)${booking.guests?.children ? `, ${booking.guests.children} Child(ren)` : ''}</td></tr>
      <tr class="amt"><td>Total Paid</td><td style="color:#059669;font-size:15px">₹${amount}</td></tr>
    </table>

    <div class="cta">
      <a href="${bookingUrl}" class="btn">View My Booking</a>
    </div>

    <div class="note">
      📋 Save your booking ref <strong>${booking.bookingReference}</strong> — needed at check-in.
    </div>
  </div>

  <div class="f">
    © ${new Date().getFullYear()} Shimla Travels &nbsp;|&nbsp; shimlaatravels@gmail.com
  </div>

</div>
</body>
</html>`
    });

  } catch (err) {
    console.error(`[EMAIL] BOOKING CONFIRMATION FAILED for ${toEmail}: ${err.message}`);
    logger.error(`[EMAIL] BOOKING CONFIRMATION FAILED for ${toEmail}: ${err.message}`);
  }
};

// ─── Booking Cancellation ─────────────────────────────────────────────────────
const sendBookingCancellationEmail = async (toEmail, userName, booking) => {
  try {
    const itemName = booking.hotelName || booking.packageTitle || 'Your Booking';
    const support = 'shimlaatravels@gmail.com';

    await _send('BOOKING CANCELLATION', {
      to: toEmail,
      subject: `Booking Cancelled — ${booking.bookingReference}`,
      textContent: `Hi ${userName},\n\nYour booking ${booking.bookingReference} for ${itemName} has been cancelled.\n\nRefunds take 5-7 business days.\nQuestions? ${support}\n\n— Shimla Travels`,
      htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}.h{background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center}.h h1{color:#fff;margin:0;font-size:20px;font-weight:700}.b{padding:36px 40px;color:#2d3748;font-size:15px;line-height:1.7}.ref{background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px;margin:16px 0;text-align:center;font-size:20px;font-weight:800;color:#e11d48}.info{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;font-size:13px;color:#1e40af;margin-top:16px}.f{background:#f7fafc;padding:20px 40px;text-align:center;font-size:12px;color:#718096}</style></head><body><div class="w"><div class="h"><h1>Booking Cancelled</h1></div><div class="b"><p>Hi <strong>${userName}</strong>,</p><p>Your booking for <strong>${itemName}</strong> has been cancelled.</p><div class="ref">${booking.bookingReference}</div><div class="info">💳 Refunds processed within 5-7 business days.<br/>📧 Questions? <a href="mailto:${support}">${support}</a></div></div><div class="f">© ${new Date().getFullYear()} Shimla Travels</div></div></body></html>`,
    });
  } catch (err) {
    console.error(`[EMAIL] BOOKING CANCELLATION FAILED for ${toEmail}: ${err.message}`);
    logger.error(`[EMAIL] BOOKING CANCELLATION FAILED for ${toEmail}: ${err.message}`);
  }
};

// ─── Contact Form ─────────────────────────────────────────────────────────────
const sendContactFormEmail = async ({ name, email, phone, message }) => {
  const inboxEmail = process.env.SUPPORT_EMAIL || 'shimlaatravels@gmail.com';
  const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const submittedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const result = await _send('CONTACT FORM → INBOX', {
    to: inboxEmail,
    replyTo: email,
    subject: `📩 New Contact Message from ${name}`,
    textContent: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nMessage:\n${message}\n\nSubmitted: ${submittedAt} IST`,
    htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}.h{background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:28px 40px;text-align:center}.h h1{color:#fff;margin:0;font-size:20px;font-weight:700}.b{padding:32px 40px;color:#2d3748}.field{margin-bottom:16px}.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#718096;margin-bottom:4px}.val{font-size:15px;color:#1a202c}.msg{background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:15px;line-height:1.7;white-space:pre-wrap;margin-top:4px}.btn{display:inline-block;margin-top:20px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff!important;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600}.f{background:#f7fafc;padding:16px 40px;text-align:center;font-size:12px;color:#718096}</style></head><body><div class="w"><div class="h"><h1>📩 New Contact Message</h1></div><div class="b"><div class="field"><div class="lbl">Name</div><div class="val">${name}</div></div><div class="field"><div class="lbl">Email</div><div class="val"><a href="mailto:${email}">${email}</a></div></div><div class="field"><div class="lbl">Phone</div><div class="val">${phone || 'Not provided'}</div></div><div class="field"><div class="lbl">Message</div><div class="msg">${safeMsg}</div></div><a href="mailto:${email}?subject=Re: Your Shimla Travels Enquiry" class="btn">Reply to ${name}</a><div style="font-size:12px;color:#a0aec0;margin-top:16px">Submitted: ${submittedAt} IST</div></div><div class="f">© ${new Date().getFullYear()} Shimla Travels</div></div></body></html>`,
  });

  // Auto-reply to visitor
  _send('CONTACT AUTO-REPLY', {
    to: email,
    subject: '✅ We received your message — Shimla Travels',
    textContent: `Hi ${name},\n\nThank you for contacting Shimla Travels! We'll reply within 24 hours.\n\nUrgent? Call: ${process.env.SUPPORT_PHONE || '+919876543210'}\n\n— Shimla Travels`,
    htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}.w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}.h{background:linear-gradient(135deg,#10b981,#059669);padding:28px 40px;text-align:center}.h h1{color:#fff;margin:0;font-size:20px;font-weight:700}.b{padding:32px 40px;color:#2d3748;font-size:15px;line-height:1.7}.f{background:#f7fafc;padding:16px 40px;text-align:center;font-size:12px;color:#718096}</style></head><body><div class="w"><div class="h"><h1>✅ Message Received!</h1></div><div class="b"><p>Hi <strong>${name}</strong>,</p><p>Thanks for reaching out! We'll reply within <strong>24 hours</strong>.</p><p>📞 Urgent? Call: <strong>${process.env.SUPPORT_PHONE || '+919876543210'}</strong></p></div><div class="f">© ${new Date().getFullYear()} Shimla Travels</div></div></body></html>`,
  }).catch(e => console.error(`[EMAIL] AUTO-REPLY failed: ${e.message}`));

  return result;
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendContactFormEmail,
  runStartupEmailTest,
};