const nodemailer = require('nodemailer');
const logger = require('./logger');

// ─── Validate that real Gmail credentials are present ────────────────────────

const validateCredentials = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(
      'EMAIL_USER and EMAIL_PASS must be set in Backendd/.env\n' +
      '  → Set EMAIL_USER to your Gmail address\n' +
      '  → Set EMAIL_PASS to your Gmail App Password (not your real password)\n' +
      '  → Generate one at: https://myaccount.google.com/apppasswords'
    );
  }

  const isPlaceholder =
    user.includes('your-gmail') ||
    user.includes('your-email') ||
    pass.replace(/\s/g, '') === 'xxxxxxxxxxxxxxxxxxxx'.substring(0, pass.replace(/\s/g, '').length) ||
    pass.includes('xxxx');

  if (isPlaceholder) {
    throw new Error(
      'Placeholder credentials detected in .env — please replace them:\n' +
      `  EMAIL_USER is currently: "${user}"\n` +
      '  Set it to your real Gmail address and generate an App Password.'
    );
  }

  return { user, pass };
};

// ─── Create Gmail transporter ─────────────────────────────────────────────────

const createTransporter = () => {
  const { user, pass } = validateCredentials();

  return nodemailer.createTransport({
    service: 'gmail',          // Uses Gmail's built-in config (no host/port needed)
    auth: {
      user,
      pass,                    // Gmail App Password (16 chars, spaces are fine)
    },
  });
};

// ─── Verify connection on first use (gives a clear error if credentials wrong) ─

let connectionVerified = false;

const verifyConnection = async (transporter) => {
  if (connectionVerified) return;
  try {
    await transporter.verify();
    connectionVerified = true;
    logger.info('✅ Gmail SMTP connection verified successfully');
  } catch (error) {
    const hint =
      error.message.includes('535') || error.message.includes('Username and Password')
        ? '\n  HINT: Make sure you are using a Gmail APP PASSWORD, not your regular Gmail password.\n  Generate one at https://myaccount.google.com/apppasswords'
        : error.message.includes('534')
          ? '\n  HINT: Enable 2-Step Verification on your Google account first, then generate an App Password.'
          : '';
    throw new Error(`Gmail SMTP authentication failed: ${error.message}${hint}`);
  }
};

// ─── Send Password Reset Email ────────────────────────────────────────────────

const sendPasswordResetEmail = async (toEmail, resetToken, userName = 'User') => {
  const transporter = createTransporter();
  await verifyConnection(transporter);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;
  const fromName = process.env.EMAIL_FROM || `"Shimla Travels" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: '🔐 Reset Your Shimla Travels Password',

    text: `
Hi ${userName},

You requested a password reset for your Shimla Travels account.

Reset link (valid for 10 minutes):
${resetUrl}

If you did not request this, please ignore this email — your password will remain unchanged.

— Shimla Travels Support Team
    `.trim(),

    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .header p  { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #2d3748; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .fallback { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; word-break: break-all; font-size: 13px; color: #4a5568; }
    .warning { background: #fff8e1; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #78350f; margin-top: 20px; }
    .footer { background: #f7fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏔️ Shimla Travels</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p>Hi <strong>${userName}</strong>,</p>
      <p>We received a request to reset the password for your Shimla Travels account associated with <strong>${toEmail}</strong>.</p>
      <p>Click the button below to choose a new password:</p>
      <div class="btn-wrap">
        <a href="${resetUrl}" class="btn">Reset My Password</a>
      </div>
      <hr class="divider" />
      <p style="font-size:13px;color:#718096;">If the button doesn't work, copy and paste this link into your browser:</p>
      <div class="fallback">${resetUrl}</div>
      <div class="warning">
        ⚠️ <strong>This link expires in 10 minutes</strong> and can only be used once.<br/>
        If you did not request a password reset, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Shimla Travels. All rights reserved.</p>
      <p>This is an automated message — please do not reply.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`✅ Password reset email sent to ${toEmail} — MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`❌ Failed to send password reset email to ${toEmail}: ${error.message}`);
    throw new Error('Email could not be sent. Please check your Gmail App Password in .env and try again.');
  }
};

// ─── Send Password Changed Confirmation Email ──────────────────────────────

const sendPasswordChangedEmail = async (toEmail, userName = 'User') => {
  let transporter;
  try {
    transporter = createTransporter();
    await verifyConnection(transporter);
  } catch (err) {
    logger.error(`❌ Could not create transporter for password-changed email: ${err.message}`);
    return; // Don't block — password was already changed, this is just a notification
  }

  const fromName = process.env.EMAIL_FROM || `"Shimla Travels" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: '✅ Your Shimla Travels Password Has Been Changed',
    text: `
Hi ${userName},

Your Shimla Travels account password was successfully changed.

If you did NOT make this change, contact us immediately at ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}.

— Shimla Travels Security Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Password Changed</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981, #047857); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
    .body { padding: 40px; color: #2d3748; font-size: 15px; line-height: 1.7; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #78350f; margin-top: 20px; }
    .footer { background: #f7fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>✅ Password Changed Successfully</h1></div>
    <div class="body">
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your <strong>Shimla Travels</strong> account password was successfully updated. You can now log in with your new password.</p>
      <div class="alert">
        🔒 If you did <strong>NOT</strong> make this change, contact us immediately at
        <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}">${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}</a>.
      </div>
    </div>
    <div class="footer">© ${new Date().getFullYear()} Shimla Travels. All rights reserved.</div>
  </div>
</body>
</html>
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`✅ Password-changed confirmation sent to ${toEmail} — MessageId: ${info.messageId}`);
  } catch (error) {
    logger.error(`❌ Failed to send password-changed email to ${toEmail}: ${error.message}`);
    // Don't throw — password was already changed, this is just a notification
  }
};


// ─── Send Booking Confirmation Email ──────────────────────────────────────
const sendBookingConfirmationEmail = async (toEmail, userName, booking) => {
  let transporter;
  try {
    transporter = createTransporter();
    await verifyConnection(transporter);
  } catch (err) {
    logger.error(`Could not send booking confirmation to ${toEmail}: ${err.message}`);
    return;
  }

  const fromName = process.env.EMAIL_FROM || `"Shimla Travels" <${process.env.EMAIL_USER}>`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const bookingUrl = `${clientUrl}/account`;

  const isHotel = booking.bookingType === 'hotel';
  const itemName = booking.hotelName || booking.packageTitle || 'Your Booking';
  const dateInfo = isHotel
    ? `Check-in: ${new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} — Check-out: ${new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `Travel Date: ${new Date(booking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const amount = booking.pricing?.totalAmount?.toLocaleString('en-IN') || '0';

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: `✅ Booking Confirmed — ${booking.bookingReference}`,
    text: `Hi ${userName}, your booking ${booking.bookingReference} for ${itemName} is confirmed. ${dateInfo}. Total paid: ₹${amount}. View it at ${bookingUrl}.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Confirmed</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
    .wrapper{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
    .header{background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
    .header p{color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px}
    .body{padding:36px 40px;color:#2d3748}
    .body p{font-size:15px;line-height:1.7;margin:0 0 14px}
    .ref-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:20px 0;text-align:center}
    .ref-box .ref{font-size:22px;font-weight:800;color:#059669;letter-spacing:1px}
    .detail-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
    .detail-table td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
    .detail-table td:first-child{color:#718096;font-weight:500;width:40%}
    .detail-table td:last-child{color:#1a202c;font-weight:600}
    .amount-row td{background:#f7fafc;font-size:15px}
    .btn-wrap{text-align:center;margin:28px 0}
    .btn{display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff!important;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:15px;font-weight:600}
    .info-box{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;font-size:13px;color:#1e40af;margin-top:16px}
    .footer{background:#f7fafc;padding:20px 40px;text-align:center;font-size:12px;color:#718096}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏔️ Booking Confirmed!</h1>
      <p>Your Shimla Travels adventure is all set</p>
    </div>
    <div class="body">
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Great news! Your booking has been confirmed and payment received. Here are your booking details:</p>
      <div class="ref-box">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px">BOOKING REFERENCE</div>
        <div class="ref">${booking.bookingReference}</div>
      </div>
      <table class="detail-table">
        <tr><td>${isHotel ? 'Hotel' : 'Package'}</td><td>${itemName}</td></tr>
        <tr><td>${isHotel ? 'Check-in' : 'Travel Date'}</td><td>${isHotel ? new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date(booking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
        ${isHotel ? `<tr><td>Check-out</td><td>${new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>` : ''}
        <tr><td>Guests</td><td>${booking.guests?.adults || 1} Adult(s)${booking.guests?.children ? `, ${booking.guests.children} Child(ren)` : ''}</td></tr>
        <tr class="amount-row"><td>Total Paid</td><td style="color:#059669">₹${amount}</td></tr>
      </table>
      <div class="btn-wrap">
        <a href="${bookingUrl}" class="btn">View My Booking</a>
      </div>
      <div class="info-box">
        📋 Keep this email safe — your booking reference is <strong>${booking.bookingReference}</strong>.
        You may need it for check-in or any support requests.
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Shimla Travels. All rights reserved.</p>
      <p>Questions? Contact us at ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Booking confirmation sent to ${toEmail} — ${info.messageId}`);
  } catch (err) {
    logger.error(`Failed to send booking confirmation to ${toEmail}: ${err.message}`);
  }
};


// ─── Send Booking Cancellation Email ──────────────────────────────────────
const sendBookingCancellationEmail = async (toEmail, userName, booking) => {
  let transporter;
  try {
    transporter = createTransporter();
    await verifyConnection(transporter);
  } catch (err) {
    logger.error(`Could not send cancellation email to ${toEmail}: ${err.message}`);
    return;
  }

  const fromName = process.env.EMAIL_FROM || `"Shimla Travels" <${process.env.EMAIL_USER}>`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const itemName = booking.hotelName || booking.packageTitle || 'Your Booking';

  const mailOptions = {
    from: fromName,
    to: toEmail,
    subject: `Booking Cancelled — ${booking.bookingReference}`,
    text: `Hi ${userName}, your booking ${booking.bookingReference} for ${itemName} has been cancelled. If this was unexpected, contact us at ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}.`,
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .w{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
  .h{background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center}
  .h h1{color:#fff;margin:0;font-size:20px;font-weight:700}
  .b{padding:36px 40px;color:#2d3748;font-size:15px;line-height:1.7}
  .ref{background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px 18px;margin:16px 0;text-align:center;font-size:20px;font-weight:800;color:#e11d48}
  .info{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;font-size:13px;color:#1e40af;margin-top:16px}
  .f{background:#f7fafc;padding:20px 40px;text-align:center;font-size:12px;color:#718096}
</style></head><body>
<div class="w">
  <div class="h"><h1>Booking Cancelled</h1></div>
  <div class="b">
    <p>Hi <strong>${userName}</strong>,</p>
    <p>Your booking for <strong>${itemName}</strong> has been cancelled.</p>
    <div class="ref">${booking.bookingReference}</div>
    <div class="info">
      If a payment was made, refunds are processed within 5-7 business days to your original payment method.<br/>
      Questions? Contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}">${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}</a>
    </div>
  </div>
  <div class="f">© ${new Date().getFullYear()} Shimla Travels. All rights reserved.</div>
</div></body></html>`.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Cancellation email sent to ${toEmail} — ${info.messageId}`);
  } catch (err) {
    logger.error(`Failed to send cancellation email to ${toEmail}: ${err.message}`);
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
};
