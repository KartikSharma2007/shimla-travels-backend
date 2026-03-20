const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Support Controller — Shimla Travels
 * Automated chat with intelligent NLP intent detection for typed messages.
 */

// ─────────────────────────────────────────────────────
//  SESSION STORAGE  (swap for Redis in production)
// ─────────────────────────────────────────────────────
const chatSessions = new Map();

// ─────────────────────────────────────────────────────
//  NLP INTENT RECOGNITION ENGINE
// ─────────────────────────────────────────────────────

/**
 * Intent definitions.
 * Each intent has:
 *  - keywords  : single words (weight 1)
 *  - patterns  : regex patterns (weight 2)
 *  - phrases   : exact sub-string matches (weight 3)
 *  - weight    : overall multiplier for this intent
 */
const INTENT_DEFINITIONS = {
  booking_issue: {
    keywords: ['book', 'booking', 'reservation', 'reserved', 'reserve', 'booked', 'confirm', 'confirmation'],
    patterns: [/\bbook(?:ing|ed)?\b/i, /reserv(?:e|ed|ation)\b/i, /my\s+(?:hotel|trip|stay|package)\b/i],
    phrases: ['my booking', 'i booked', 'booking issue', 'booking problem', 'booking not found', 'modify booking', 'change booking'],
    weight: 1.0,
  },
  modify_booking: {
    keywords: ['modify', 'change', 'update', 'edit', 'reschedule', 'alter'],
    patterns: [/(?:modify|change|update|edit)\s+(?:my\s+)?booking/i, /reschedule/i],
    phrases: ['modify booking', 'change my booking', 'update booking', 'change dates', 'reschedule booking'],
    weight: 1.2,
  },
  cancel_booking: {
    keywords: ['cancel', 'cancellation', 'cancelled', 'canceling', 'abort'],
    patterns: [/cancel(?:l(?:ed|ing))?\b/i, /want\s+to\s+cancel/i],
    phrases: ['cancel booking', 'cancel my booking', 'how to cancel', 'cancellation policy', 'cancel reservation'],
    weight: 1.2,
  },
  payment_problem: {
    keywords: ['pay', 'payment', 'paid', 'paying', 'transaction', 'charge', 'charged', 'deducted', 'deduct', 'money', 'amount', 'bill'],
    patterns: [/pay(?:ment|ing|ed)?\b/i, /(?:amount|money)\s+(?:deducted|charged|debited)/i],
    phrases: ['payment failed', 'payment issue', 'payment problem', 'not able to pay', 'cant pay', 'payment not working'],
    weight: 1.0,
  },
  card_declined: {
    keywords: ['card', 'credit', 'debit', 'declined', 'rejected', 'visa', 'mastercard', 'rupay'],
    patterns: [/card\s+(?:declined|rejected|failed)/i, /(?:credit|debit)\s+card/i],
    phrases: ['card declined', 'card rejected', 'credit card not working', 'debit card failed'],
    weight: 1.3,
  },
  upi_issue: {
    keywords: ['upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'bhim'],
    patterns: [/upi\b/i, /(?:google|g)\s*pay/i, /phone\s*pe/i],
    phrases: ['upi failed', 'upi not working', 'google pay issue', 'phonepe problem', 'paytm failed'],
    weight: 1.3,
  },
  double_charge: {
    keywords: ['double', 'twice', 'duplicate', 'two times'],
    patterns: [/(?:charged|deducted)\s+twice/i, /double\s+charge/i, /duplicate\s+(?:charge|payment)/i],
    phrases: ['charged twice', 'double charged', 'duplicate payment', 'two times charged'],
    weight: 1.4,
  },
  refund_status: {
    keywords: ['refund', 'refunded', 'money back', 'return money', 'cashback', 'reversal'],
    patterns: [/refund/i, /money\s+(?:back|return|returned)/i, /get\s+(?:my\s+)?money\s+back/i],
    phrases: ['refund status', 'where is my refund', 'when will i get refund', 'refund not received', 'refund time'],
    weight: 1.0,
  },
  hotel_details: {
    keywords: ['hotel', 'hotels', 'stay', 'accommodation', 'lodge', 'resort', 'room', 'rooms', 'property', 'guest house'],
    patterns: [/hotel/i, /(?:place|room)\s+to\s+stay/i, /accommodation/i, /resort\b/i],
    phrases: ['show hotels', 'hotel details', 'hotel information', 'find hotel', 'available hotels', 'hotels in shimla', 'hotel list'],
    weight: 1.0,
  },
  hotel_amenities: {
    keywords: ['amenities', 'facilities', 'wifi', 'pool', 'gym', 'spa', 'parking', 'breakfast', 'restaurant', 'features'],
    patterns: [/amenities/i, /facilities/i, /(?:what|which)\s+amenities/i],
    phrases: ['hotel facilities', 'hotel amenities', 'does hotel have wifi', 'swimming pool', 'gym available'],
    weight: 1.2,
  },
  checkin_time: {
    keywords: ['checkin', 'checkout', 'check-in', 'check-out', 'arrival', 'departure', 'timing'],
    patterns: [/check[\s-]?(?:in|out)\s+time/i, /(?:arrival|departure)\s+time/i, /when\s+(?:can|do)\s+(?:i|we)\s+check/i],
    phrases: ['check in time', 'check out time', 'when to check in', 'early check in', 'late checkout'],
    weight: 1.2,
  },
  cancellation_policy: {
    keywords: ['policy', 'policies', 'terms', 'condition', 'conditions', 'charges', 'penalty'],
    patterns: [/cancellation\s+policy/i, /(?:cancel|cancellation)\s+charge/i, /refund\s+policy/i],
    phrases: ['cancellation policy', 'hotel policy', 'what is the policy', 'cancellation charges', 'cancellation terms'],
    weight: 1.1,
  },
  package_info: {
    keywords: ['package', 'packages', 'tour', 'tours', 'trip', 'trips', 'travel', 'itinerary', 'destination'],
    patterns: [/package/i, /tour\s+package/i, /travel\s+package/i, /(?:what|which)\s+packages/i],
    phrases: ['show packages', 'package details', 'travel packages', 'tour packages', 'available packages', 'packages in shimla'],
    weight: 1.0,
  },
  package_types: {
    keywords: ['adventure', 'family', 'romantic', 'honeymoon', 'group', 'solo', 'budget', 'luxury', 'type', 'category'],
    patterns: [/(?:what|which)\s+type\s+of\s+package/i, /package\s+(?:types|categories)/i, /adventure\s+package/i],
    phrases: ['types of packages', 'package categories', 'adventure tour', 'family package', 'honeymoon package', 'luxury package'],
    weight: 1.1,
  },
  whats_included: {
    keywords: ['included', 'includes', 'inclusion', 'cover', 'covered', 'comprise', 'consists'],
    patterns: [/what(?:'s|\s+is)\s+included/i, /what\s+(?:do|does)\s+(?:the\s+)?package\s+include/i],
    phrases: ['what is included', 'what does package include', 'package inclusions', 'whats included', 'meals included'],
    weight: 1.2,
  },
  group_size: {
    keywords: ['group', 'groups', 'people', 'persons', 'members', 'travelers', 'pax', 'capacity'],
    patterns: [/group\s+(?:size|booking|tour|discount)/i, /(?:how\s+many|number\s+of)\s+people/i, /per\s+person\s+(?:price|cost|rate)/i],
    phrases: ['group size', 'group discount', 'how many people', 'price per person', 'group booking'],
    weight: 1.1,
  },
  custom_package: {
    keywords: ['custom', 'customize', 'customise', 'personalized', 'tailor', 'tailored', 'own package'],
    patterns: [/custom(?:ize|ise|ized|ised)?\s+package/i, /(?:create|make|design)\s+(?:my\s+own|a\s+)?(?:package|tour)/i],
    phrases: ['custom package', 'customize package', 'personalized tour', 'tailor made package', 'design my own tour'],
    weight: 1.3,
  },
  account_issues: {
    keywords: ['account', 'profile', 'login', 'sign in', 'sign up', 'register', 'password', 'username'],
    patterns: [/(?:my\s+)?account/i, /(?:can't|cannot)\s+log(?:in|\s+in)/i, /sign\s+(?:in|up)/i],
    phrases: ['account issue', 'login problem', 'cant login', 'account not working', 'sign in issue'],
    weight: 1.0,
  },
  forgot_password: {
    keywords: ['forgot', 'forget', 'forgotten', 'reset', 'password', 'lost password'],
    patterns: [/forgot\s+(?:my\s+)?password/i, /reset\s+password/i, /(?:can't|cannot)\s+remember\s+(?:my\s+)?password/i],
    phrases: ['forgot password', 'reset password', 'lost password', 'recover password', 'change password'],
    weight: 1.3,
  },
  pet_policy: {
    keywords: ['pet', 'pets', 'dog', 'cat', 'animal', 'animals'],
    patterns: [/pet[\s-]?friendly/i, /(?:bring|take)\s+(?:my\s+)?(?:pet|dog|cat)/i, /pets?\s+allowed/i],
    phrases: ['pet friendly hotel', 'can i bring my pet', 'pets allowed', 'dog friendly hotel'],
    weight: 1.4,
  },
  find_hotel: {
    keywords: ['find', 'search', 'look', 'browse', 'show', 'list', 'available', 'near'],
    patterns: [/(?:find|search|show|list)\s+(?:me\s+)?hotels?/i, /available\s+hotels?/i, /hotels?\s+(?:near|in|at)\b/i],
    phrases: ['find hotel', 'search hotel', 'show me hotels', 'available hotels', 'hotels near me', 'hotels in shimla'],
    weight: 1.1,
  },
  speak_agent: {
    keywords: ['agent', 'human', 'person', 'staff', 'help', 'support', 'representative', 'talk', 'speak', 'contact', 'call'],
    patterns: [/(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|agent|person|staff)/i],
    phrases: ['speak to agent', 'talk to human', 'real person', 'contact support', 'need help', 'human support'],
    weight: 1.0,
  },
};

/**
 * Score every intent and return the best match, or 'default'.
 */
function detectIntent(lower) {
  const scores = {};

  for (const [key, def] of Object.entries(INTENT_DEFINITIONS)) {
    let score = 0;

    for (const phrase of def.phrases) {
      if (lower.includes(phrase)) score += 3.0 * def.weight;
    }
    for (const pattern of def.patterns) {
      if (pattern.test(lower)) score += 2.0 * def.weight;
    }
    for (const kw of def.keywords) {
      if (lower.includes(kw)) score += 1.0 * def.weight;
    }

    if (score > 0) scores[key] = score;
  }

  if (!Object.keys(scores).length) return 'default';
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Resolve what chatResponses key to use.
 */
function resolveResponseKey(message, quickReplyId) {
  // Button click
  if (quickReplyId && chatResponses[quickReplyId]) return quickReplyId;

  if (!message) return 'default';

  const lower = message.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|hiya|howdy|greetings|good\s+(morning|afternoon|evening)|namaste)\b/.test(lower)) {
    return 'welcome_reply';
  }
  // Closing / positive feedback
  if (/^(thanks?|thank\s+you|ok|okay|done|bye|goodbye|great|nice|cool|awesome|perfect)\b/.test(lower)) {
    return 'thank_you';
  }

  return detectIntent(lower);
}

// ─────────────────────────────────────────────────────
//  RESPONSE DATABASE
// ─────────────────────────────────────────────────────
const chatResponses = {
  welcome: {
    message: "Welcome to Shimla Travels 👋 How can we help you today?",
    quickReplies: [
      { id: 'booking_issue', label: 'Booking Issue', icon: '📋' },
      { id: 'payment_problem', label: 'Payment Problem', icon: '💳' },
      { id: 'refund_status', label: 'Refund Status', icon: '💰' },
      { id: 'hotel_details', label: 'Hotel Details', icon: '🏨' },
      { id: 'package_info', label: 'Package Information', icon: '📦' },
      { id: 'account_issues', label: 'Account Issues', icon: '👤' },
    ],
  },

  welcome_reply: {
    message: "Hello! 👋 Welcome to Shimla Travels. How can I assist you today?",
    quickReplies: [
      { id: 'hotel_details', label: 'Hotels', icon: '🏨' },
      { id: 'package_info', label: 'Packages', icon: '📦' },
      { id: 'booking_issue', label: 'My Bookings', icon: '📋' },
      { id: 'speak_agent', label: 'Talk to Agent', icon: '🧑‍💼' },
    ],
  },

  thank_you: {
    message: "You're welcome! 😊 Is there anything else I can help you with?",
    quickReplies: [
      { id: 'hotel_details', label: 'Hotels', icon: '🏨' },
      { id: 'package_info', label: 'Packages', icon: '📦' },
      { id: 'booking_issue', label: 'My Bookings', icon: '📋' },
    ],
  },

  booking_issue: {
    message: "I'm sorry you're having trouble with your booking. Here are some common solutions:",
    options: [
      { id: 'modify_booking', label: 'Modify my booking' },
      { id: 'cancel_booking', label: 'Cancel my booking' },
      { id: 'booking_not_found', label: "Can't find my booking" },
      { id: 'payment_failed', label: 'Payment failed but amount deducted' },
      { id: 'speak_agent', label: 'Speak to a human agent' },
    ],
    details: `**Common Booking Issues:**

1. **Payment Failed**: If your payment failed but amount was deducted, it will be automatically refunded within 5-7 business days.
2. **Booking Not Found**: Check your email for the booking confirmation. The reference starts with HTL- or PKG-.
3. **Modification**: Bookings can be modified up to 48 hours before check-in/travel date.
4. **Cancellation**: Free cancellation up to 24 hours before for hotels, 7 days for packages.`,
  },

  modify_booking: {
    message: "To modify your booking, please provide your booking reference number (starts with HTL- or PKG-). Our team will assist you within 2 hours.",
    action: {
      type: 'input',
      placeholder: 'Enter booking reference (e.g., HTL-ABC123)',
      buttonText: 'Submit Request',
    },
    details: `**Booking Modification Policy:**
- Hotels: Can be modified up to 48 hours before check-in
- Packages: Can be modified up to 7 days before travel date
- Date changes may affect pricing
- Room type upgrades are subject to availability`,
  },

  cancel_booking: {
    message: "To cancel your booking, please provide your booking reference number.",
    action: {
      type: 'input',
      placeholder: 'Enter booking reference (e.g., HTL-ABC123)',
      buttonText: 'Request Cancellation',
    },
    details: `**Cancellation Policy:**

**Hotels:**
- Free cancellation up to 24 hours before check-in
- 50% charge for cancellations within 24 hours
- No refund for no-shows

**Packages:**
- Free cancellation up to 7 days before travel
- 10% charge for cancellations 3-7 days before
- 50% charge for cancellations within 3 days

Refunds are processed within 5-7 business days.`,
  },

  booking_not_found: {
    message: "Let me help you find your booking. Please check:",
    details: `**Finding Your Booking:**

1. Check your email (including spam/junk folder) for confirmation
2. Look for emails from: noreply@shimlatravels.com
3. Your booking reference starts with **HTL-** (hotels) or **PKG-** (packages)

If you still can't find it, please provide the email used, booking date, and approximate amount paid.`,
    action: {
      type: 'form',
      fields: [
        { name: 'email', label: 'Email used for booking', type: 'email' },
        { name: 'bookingDate', label: 'Date of booking', type: 'date' },
        { name: 'amount', label: 'Approximate amount', type: 'text' },
      ],
      buttonText: 'Search Booking',
    },
  },

  payment_failed: {
    message: "I understand your concern about the failed payment. Here's what happens:",
    details: `**Failed Payment with Deduction:**

✅ **Don't worry!** If the payment failed but amount was deducted:

1. The amount is held by your bank, not charged
2. It will be automatically released within 5-7 business days
3. No action needed from your side
4. You can try booking again with a different payment method

**If not refunded after 7 days:**
- Contact your bank with the transaction reference
- Or email us at support@shimlatravels.com`,
    quickReplies: [
      { id: 'speak_agent', label: 'Contact support' },
    ],
  },

  payment_problem: {
    message: "Having payment issues? Let me help:",
    options: [
      { id: 'payment_failed', label: 'Payment failed but amount deducted' },
      { id: 'card_declined', label: 'Card declined' },
      { id: 'upi_issue', label: 'UPI payment issue' },
      { id: 'double_charge', label: 'Double charged' },
    ],
    details: `**Payment Methods Accepted:**
- UPI (Google Pay, PhonePe, Paytm)
- Credit/Debit Cards (Visa, Mastercard, RuPay)
- Net Banking (all major banks)
- Wallets (Paytm, Mobikwik)

All payments are processed securely through Razorpay with 256-bit SSL encryption.`,
  },

  card_declined: {
    message: "If your card was declined, please try these solutions:",
    details: `**Card Declined Solutions:**

1. **Check card details** — Ensure number, expiry, and CVV are correct
2. **Sufficient balance** — Verify available credit limit / balance
3. **International transactions** — Enable for your card if required
4. **Bank restrictions** — Contact your bank if they blocked the transaction
5. **Try another method** — UPI, Net Banking, or Paytm Wallet`,
  },

  upi_issue: {
    message: "UPI payment issues are usually temporary. Here's what to do:",
    details: `**UPI Payment Solutions:**

1. **Check UPI ID** — Ensure you entered the correct UPI ID
2. **App issues** — Try a different UPI app
3. **Network** — Ensure stable internet connection
4. **Limits** — Check your daily UPI transaction limit

**Recommended UPI Apps:** Google Pay, PhonePe, Paytm, BHIM

If issues persist, try Card or Net Banking payment.`,
  },

  double_charge: {
    message: "If you were double charged, we'll resolve this immediately:",
    details: `**Double Charge Resolution:**

✅ **We apologize for the inconvenience!**

1. The duplicate charge will be automatically refunded within 3-5 business days
2. You'll receive an email confirmation for the refund
3. If not received, contact us with both transaction references

📞 ${process.env.SUPPORT_PHONE || '+91-98765-43210'}
📧 ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}`,
  },

  refund_status: {
    message: "Let me help you check your refund status:",
    options: [
      { id: 'check_refund', label: 'Check refund status' },
      { id: 'refund_not_received', label: 'Refund not received' },
    ],
    details: `**Refund Processing Times:**
- UPI: 3-5 business days
- Credit Card: 5-7 business days
- Debit Card: 5-10 business days
- Net Banking: 3-5 business days
- Wallets: Instant to 24 hours`,
  },

  check_refund: {
    message: "To check your refund status, please provide your booking reference:",
    action: {
      type: 'input',
      placeholder: 'Enter booking reference (e.g., HTL-ABC123)',
      buttonText: 'Check Status',
    },
  },

  refund_not_received: {
    message: "If your refund hasn't been received within the expected time:",
    details: `**Refund Not Received?**

1. Check with your bank — sometimes refunds are pending at bank's end
2. Check all accounts — refund goes to original payment method
3. Wait 2 more days — bank holidays may cause delays

**Still not received?**
📞 ${process.env.SUPPORT_PHONE || '+91-98765-43210'}
📧 ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}`,
  },

  hotel_details: {
    message: "Looking for hotel information? Here's what I can help with:",
    options: [
      { id: 'hotel_amenities', label: 'Hotel amenities' },
      { id: 'checkin_time', label: 'Check-in/out times' },
      { id: 'cancellation_policy', label: 'Cancellation policy' },
      { id: 'pet_policy', label: 'Pet policy' },
      { id: 'find_hotel', label: 'Find a hotel' },
    ],
  },

  hotel_amenities: {
    message: "Our hotels offer a wide range of amenities:",
    details: `**Common Hotel Amenities:**

🏨 **Standard:** Free WiFi, Room Service, TV, Attached Bathroom, Hot Water

🌟 **Premium:** Swimming Pool, Spa, Fitness Center, Restaurant & Bar, Conference Rooms, Parking

Amenities vary by hotel — check individual hotel pages for complete details.`,
  },

  checkin_time: {
    message: "Here are the standard check-in and check-out times:",
    details: `**Check-in & Check-out Times:**

🕑 **Standard:** Check-in 2:00 PM · Check-out 11:00 AM

**Early Check-in:** Subject to availability, may incur additional charges.

**Late Check-out:** Available on request, charges may apply after 12:00 PM.

**24-hour Check-in:** Available at select hotels.`,
  },

  cancellation_policy: {
    message: "Our hotel cancellation policy:",
    details: `**Hotel Cancellation Policy:**

✅ **Free Cancellation:** Up to 24 hours before check-in
⚠️ **50% Refund:** 12-24 hours before check-in
❌ **No Refund:** Less than 12 hours or no-show

**How to Cancel:**
1. Go to My Bookings in your account
2. Select the booking → Click Cancel Booking
3. Refund will be processed within 5-7 days`,
  },

  pet_policy: {
    message: "Pet policies vary by hotel:",
    details: `**Pet Policy Information:**

🐾 **Pet-Friendly Hotels:** Clearly marked on hotel pages. Pet fees and weight limits may apply.

🚫 **Non-Pet Hotels:** Pets not allowed (service animals exempt).

Always check hotel's pet policy and inform hotel in advance before booking with pets.`,
  },

  find_hotel: {
    message: "Let me help you find the perfect hotel in Shimla:",
    action: {
      type: 'link',
      url: '/hotels',
      buttonText: 'Browse All Hotels',
    },
    details: `**Popular Categories:**
🏔️ Mountain View · 💎 Luxury · 💰 Budget · 👨‍👩‍👧 Family · 💑 Romantic

Use filters on the hotels page to find your ideal stay!`,
  },

  package_info: {
    message: "Here's information about our travel packages:",
    options: [
      { id: 'package_types', label: 'Types of packages' },
      { id: 'whats_included', label: "What's included?" },
      { id: 'group_size', label: 'Group size & pricing' },
      { id: 'custom_package', label: 'Custom packages' },
    ],
  },

  package_types: {
    message: "We offer various types of travel packages:",
    details: `**Our Package Categories:**

🏔️ Adventure · 👨‍👩‍👧 Family · 💑 Romantic · 💰 Budget
✨ Luxury · 💍 Honeymoon · 👥 Group · 🧘 Solo

Browse all packages at /packages`,
  },

  whats_included: {
    message: "Here's what's typically included in our packages:",
    details: `**Package Inclusions:**

✅ **Always Included:** Accommodation, daily breakfast, sightseeing, local transport, professional guide

🍽️ **Meals:** Breakfast always included; Lunch/Dinner as specified

🎯 **Activities:** Entry fees, adventure activities (if mentioned), cultural experiences

❌ **Not Included:** Personal expenses, tips, travel insurance, alcohol & beverages

Check individual package page for exact inclusions.`,
  },

  group_size: {
    message: "Information about group sizes and pricing:",
    details: `**Group Size & Pricing:**

👥 Standard Groups: 2-12 people
🚌 Large Groups: 12+ people (contact us)
🧍 Solo Travelers: Join group tours

**Discounts:** 6+ people: 5% off · 10+ people: 10% off

Children (2-11 yrs): 70% of adult price · Infants (under 2): Free`,
  },

  custom_package: {
    message: "Want a custom package? We'd love to create one for you!",
    action: {
      type: 'form',
      fields: [
        { name: 'name', label: 'Your Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'travelDate', label: 'Preferred Travel Date', type: 'date' },
        { name: 'groupSize', label: 'Group Size', type: 'number' },
        { name: 'requirements', label: 'Special Requirements', type: 'textarea' },
      ],
      buttonText: 'Request Custom Package',
    },
    details: `**Custom Package Benefits:**
✅ Tailored to your preferences · Flexible dates & duration
✅ Choose your own hotels · Add/remove activities

Our team will contact you within 24 hours!`,
  },

  account_issues: {
    message: "Having trouble with your account? Let me help:",
    options: [
      { id: 'forgot_password', label: 'Forgot password' },
      { id: 'change_email', label: 'Change email address' },
      { id: 'delete_account', label: 'Delete my account' },
      { id: 'update_profile', label: 'Update profile' },
    ],
  },

  forgot_password: {
    message: "I can help you reset your password:",
    action: {
      type: 'link',
      url: '/forgot-password',
      buttonText: 'Reset Password',
    },
    details: `**Password Reset Steps:**
1. Click the button above
2. Enter your registered email
3. Check your inbox for the reset link
4. Create a new password and log in

Didn't receive email? Check spam/junk folder or contact support.`,
  },

  change_email: {
    message: "To change your email address:",
    details: `**Changing Email Address:**
1. Login → Account Settings → Edit Profile
2. Update email address and save
3. Verify new email via the link sent

New email must not already be registered. Booking history will be preserved.`,
  },

  delete_account: {
    message: "We're sorry to see you go. Here's what happens when you delete your account:",
    details: `⚠️ **What will be deleted:** Personal info, saved items, preferences

✅ **What will be preserved:** Booking records (anonymized), Reviews (marked "Deleted User")

**To delete:** Account → Settings → Delete Account → Confirm with password.

This action **cannot** be undone.`,
  },

  update_profile: {
    message: "To update your profile:",
    action: {
      type: 'link',
      url: '/account',
      buttonText: 'Go to Profile',
    },
    details: `You can update: Name, Phone, Date of birth, Profile picture, Address, Preferences

**How:** Login → Account page → Edit Profile → Save`,
  },

  speak_agent: {
    message: "Connecting you to a human agent...",
    details: `**Our Support Team:**

📞 **Phone:** ${process.env.SUPPORT_PHONE || '+91-98765-43210'}
🕐 **Hours:** 9 AM - 8 PM (IST), 7 days a week

📧 **Email:** ${process.env.SUPPORT_EMAIL || 'support@shimlatravels.com'}
⏱️ Response time: Within 4 hours

Please have your booking reference ready.`,
    action: {
      type: 'contact',
      phone: process.env.SUPPORT_PHONE || '+91-98765-43210',
      email: process.env.SUPPORT_EMAIL || 'support@shimlatravels.com',
    },
  },

  default: {
    message: "I'm not sure I understand that. Could you rephrase? Here are some things I can help with:",
    quickReplies: [
      { id: 'booking_issue', label: 'Booking Issue' },
      { id: 'payment_problem', label: 'Payment Problem' },
      { id: 'refund_status', label: 'Refund Status' },
      { id: 'hotel_details', label: 'Hotel Details' },
      { id: 'package_info', label: 'Package Information' },
      { id: 'speak_agent', label: 'Speak to Agent' },
    ],
  },
};

// ─────────────────────────────────────────────────────
//  ROUTE HANDLERS
// ─────────────────────────────────────────────────────

// @desc   Initialize chat session
// @route  POST /api/support/chat/init
const initChat = asyncHandler(async (req, res) => {
  const sessionId = crypto.randomUUID();

  chatSessions.set(sessionId, {
    id: sessionId,
    messages: [],
    createdAt: new Date(),
    lastActivity: new Date(),
  });

  const welcome = chatResponses.welcome;

  res.json({
    success: true,
    data: {
      sessionId,
      message: welcome.message,
      quickReplies: welcome.quickReplies,
      timestamp: new Date(),
    },
  });
});

// @desc   Send message to chat
// @route  POST /api/support/chat/message
const sendMessage = asyncHandler(async (req, res) => {
  const { sessionId, message, quickReplyId } = req.body;

  const session = chatSessions.get(sessionId);
  if (!session) {
    return res.status(400).json({
      success: false,
      message: 'Chat session expired. Please start a new chat.',
      error: 'SESSION_EXPIRED',
    });
  }

  session.lastActivity = new Date();

  // ── Intelligent intent resolution ──
  const responseKey = resolveResponseKey(message, quickReplyId);
  const response = chatResponses[responseKey] || chatResponses.default;

  logger.info(`[Chat] "${message || quickReplyId}" → intent: "${responseKey}"`);

  session.messages.push(
    { type: 'user', content: message || quickReplyId, timestamp: new Date() },
    { type: 'bot', content: responseKey, timestamp: new Date() }
  );

  // Prune stale sessions
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  for (const [id, sess] of chatSessions.entries()) {
    if (sess.lastActivity < cutoff) chatSessions.delete(id);
  }

  res.json({
    success: true,
    data: {
      message: response.message,
      details: response.details || null,
      options: response.options || null,
      quickReplies: response.quickReplies || null,
      action: response.action || null,
      intentDetected: responseKey,
      timestamp: new Date(),
    },
  });
});

// @desc   Get support contact info
// @route  GET /api/support/contact
const getContactInfo = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      phone: {
        number: process.env.SUPPORT_PHONE || '+91-98765-43210',
        display: process.env.SUPPORT_PHONE || '+91 98765 43210',
        hours: '9 AM - 8 PM IST, 7 days',
        formattedForTel: (process.env.SUPPORT_PHONE || '+919876543210').replace(/[^\d+]/g, ''),
      },
      email: {
        address: process.env.SUPPORT_EMAIL || 'support@shimlatravels.com',
        subject: 'Support Request - Shimla Travels',
        responseTime: 'Within 4 hours',
      },
      chat: {
        available: true,
        hours: '24/7 Automated, Human agents 9 AM - 8 PM',
        averageWaitTime: 'Under 5 minutes',
      },
    },
  });
});

// @desc   Submit support ticket
// @route  POST /api/support/ticket
const submitTicket = asyncHandler(async (req, res) => {
  const { name, email, phone, category, message, bookingReference } = req.body;

  logger.info(`Support ticket submitted by ${email} - Category: ${category}`);

  res.json({
    success: true,
    message: 'Support ticket submitted successfully. We will contact you soon!',
    data: {
      ticketId: `TKT-${Date.now().toString(36).toUpperCase()}`,
      estimatedResponseTime: '4 hours',
    },
  });
});

module.exports = { initChat, sendMessage, getContactInfo, submitTicket };