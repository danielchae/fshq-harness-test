# SendGrid Webhooks & Event Tracking

**Sources:**
- https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event
- https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook

## Overview

SendGrid's Event Webhook provides real-time notifications about email events (delivered, opened, clicked, bounced, etc.). This is crucial for:
- Tracking authentication email delivery
- Monitoring transactional email engagement
- Handling bounce and spam reports
- Debugging delivery issues

## Available Events

### Delivery Events
- **`processed`**: Email has been received and is ready to be sent
- **`delivered`**: Email successfully delivered to recipient's mail server
- **`deferred`**: Delivery temporarily delayed (recipient server busy)
- **`bounce`**: Email rejected by recipient server (permanent failure)
- **`dropped`**: SendGrid dropped the email (invalid address, spam, etc.)

### Engagement Events
- **`open`**: Recipient opened the email (requires tracking pixel)
- **`click`**: Recipient clicked a link in the email (requires link rewriting)
- **`spamreport`**: Recipient marked email as spam
- **`unsubscribe`**: Recipient clicked unsubscribe link

### Group Events
- **`group_unsubscribe`**: Unsubscribed from specific email group
- **`group_resubscribe`**: Resubscribed to specific email group

## Webhook Configuration

### Setup Steps

1. **Navigate to Settings > Mail Settings > Event Webhook** in SendGrid dashboard
2. **Enable Event Webhook** and configure:
   - HTTP POST URL (your endpoint)
   - Select events to receive
   - Choose authorization method (Basic Auth or OAuth)

3. **Configure Endpoint URL**:
   ```
   https://api.fshq.gg/webhooks/sendgrid/events
   ```

4. **Select Events**: Choose relevant events for tracking

5. **Test Webhook**: Use SendGrid's test feature to verify endpoint

### Security Configuration

**Option 1: Basic Authentication**
```javascript
// Webhook endpoint with Basic Auth
app.post('/webhooks/sendgrid/events',
  basicAuth({ users: { 'webhook': process.env.WEBHOOK_SECRET } }),
  handleSendGridWebhook
)
```

**Option 2: Signature Verification**
```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, timestamp) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY
  const data = timestamp + payload

  // Verify ECDSA signature
  const verify = crypto.createVerify('sha256')
  verify.update(data)
  return verify.verify(publicKey, signature, 'base64')
}
```

## Webhook Payload Format

### Example Payload Structure

```json
[
  {
    "email": "user@example.com",
    "timestamp": 1673460000,
    "smtp-id": "<14c5d75ce93.dfd.64b469@sendgrid.net>",
    "event": "delivered",
    "category": ["signup_verification"],
    "sg_event_id": "abc123",
    "sg_message_id": "14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0",
    "response": "250 OK",
    "attempt": "1"
  },
  {
    "email": "user@example.com",
    "timestamp": 1673460120,
    "smtp-id": "<14c5d75ce93.dfd.64b469@sendgrid.net>",
    "event": "open",
    "category": ["signup_verification"],
    "sg_event_id": "def456",
    "sg_message_id": "14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0",
    "useragent": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  }
]
```

### Key Fields

- **`email`**: Recipient email address
- **`timestamp`**: Unix timestamp of the event
- **`event`**: Type of event (delivered, open, click, etc.)
- **`sg_message_id`**: Unique message identifier for tracking
- **`category`**: Custom categories passed during send (e.g., "signup_verification")
- **`sg_event_id`**: Unique event identifier (for deduplication)

## Node.js Implementation

### Express Webhook Handler

```javascript
const express = require('express')
const bodyParser = require('body-parser')
const app = express()

// Use raw body parser for webhook signature verification
app.use('/webhooks/sendgrid', bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString()
  }
}))

app.post('/webhooks/sendgrid/events', async (req, res) => {
  try {
    // Verify webhook authenticity (optional but recommended)
    const signature = req.headers['x-twilio-email-event-webhook-signature']
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp']

    if (!verifyWebhook(req.rawBody, signature, timestamp)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Process events
    const events = req.body

    for (const event of events) {
      await processEvent(event)
    }

    // Always return 200 quickly to avoid retries
    res.status(200).json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: 'Processing failed' })
  }
})

async function processEvent(event) {
  const { email, event: eventType, timestamp, sg_message_id, category } = event

  console.log(`Event: ${eventType} for ${email} at ${timestamp}`)

  switch (eventType) {
    case 'delivered':
      await handleDelivered(email, sg_message_id)
      break
    case 'bounce':
      await handleBounce(email, event.reason, event.status)
      break
    case 'open':
      await handleOpen(email, sg_message_id, event.useragent)
      break
    case 'click':
      await handleClick(email, event.url)
      break
    case 'spamreport':
      await handleSpamReport(email)
      break
    default:
      console.log(`Unhandled event type: ${eventType}`)
  }
}

async function handleDelivered(email, messageId) {
  // Update database: mark email as delivered
  await db.emails.update({ messageId }, {
    status: 'delivered',
    deliveredAt: new Date()
  })
}

async function handleBounce(email, reason, status) {
  // Log bounce and potentially disable email address
  await db.users.update({ email }, {
    emailBounced: true,
    bounceReason: reason,
    bounceStatus: status
  })

  // Alert admins for high bounce rates
  if (status === '5.1.1') { // Invalid address
    console.error(`Invalid email address: ${email}`)
  }
}

async function handleOpen(email, messageId, useragent) {
  // Track email opens for engagement metrics
  await db.emailOpens.insert({
    email,
    messageId,
    useragent,
    openedAt: new Date()
  })
}

async function handleClick(email, url) {
  // Track link clicks
  await db.emailClicks.insert({
    email,
    url,
    clickedAt: new Date()
  })
}

async function handleSpamReport(email) {
  // Immediately unsubscribe user and flag account
  await db.users.update({ email }, {
    unsubscribed: true,
    spamReport: true,
    unsubscribedAt: new Date()
  })
}
```

## Event Categories

Use categories to organize and filter webhook events:

```javascript
// When sending email, include category
const msg = {
  to: 'user@example.com',
  from: 'noreply@fshq.gg',
  subject: 'Verify your email',
  templateId: 'd-abc123',
  categories: ['signup_verification', 'authentication']
}
```

Then filter webhook events by category:

```javascript
async function processEvent(event) {
  const categories = event.category || []

  if (categories.includes('signup_verification')) {
    // Handle signup verification specific logic
    if (event.event === 'bounce') {
      await notifyAdmins('Signup verification bounced', event.email)
    }
  }
}
```

## Webhook Best Practices

### 1. Respond Quickly
- Return `200 OK` within 5 seconds
- Process events asynchronously (use queue)
- Don't perform heavy database operations in webhook handler

### 2. Handle Retries
- SendGrid retries failed webhooks (non-200 response)
- Use `sg_event_id` to deduplicate events
- Implement idempotent event processing

```javascript
async function processEvent(event) {
  const { sg_event_id } = event

  // Check if already processed
  const existing = await db.processedEvents.findOne({ sg_event_id })
  if (existing) {
    console.log(`Event ${sg_event_id} already processed, skipping`)
    return
  }

  // Process event
  await handleEvent(event)

  // Mark as processed
  await db.processedEvents.insert({ sg_event_id, processedAt: new Date() })
}
```

### 3. Secure Your Endpoint
- Use HTTPS (required by SendGrid)
- Verify webhook signatures
- Use Basic Auth or OAuth
- Whitelist SendGrid IP addresses (optional)

### 4. Monitor Webhook Health
- Track webhook delivery success rate
- Alert on missing webhooks
- Monitor processing latency
- Log all webhook failures

## Testing Webhooks Locally

### Using ngrok for Local Development

```bash
# Install ngrok
npm install -g ngrok

# Start your local server
node server.js

# Expose local server to internet
ngrok http 3000

# Use ngrok URL in SendGrid webhook settings
# Example: https://abc123.ngrok.io/webhooks/sendgrid/events
```

### Testing with SendGrid Test Button

1. Configure webhook in SendGrid dashboard
2. Click "Test Your Integration" button
3. SendGrid sends sample events to your endpoint
4. Verify your handler processes them correctly

## FSHQ.gg Use Cases

### 1. Signup Verification Tracking
```javascript
// Track delivery of verification emails
if (event.event === 'delivered' && categories.includes('signup_verification')) {
  // Mark verification email as sent in database
  await db.verificationEmails.update({ email }, { sentAt: new Date() })
}

// Alert if verification email bounces
if (event.event === 'bounce' && categories.includes('signup_verification')) {
  // Log error and potentially flag account
  await db.users.update({ email }, { verificationFailed: true })
}
```

### 2. Password Reset Monitoring
```javascript
// Track password reset email opens
if (event.event === 'open' && categories.includes('password_reset')) {
  // User opened reset email, they're likely to complete reset
  await db.passwordResets.update({ email }, { emailOpened: true })
}
```

### 3. League Invitation Engagement
```javascript
// Track invitation email clicks
if (event.event === 'click' && categories.includes('league_invitation')) {
  // User clicked invitation link
  await db.leagueInvitations.update(
    { email, leagueId: event.leagueId },
    { inviteLinkClicked: true }
  )
}
```

### 4. Bounce Management
```javascript
// Disable bounced email addresses
if (event.event === 'bounce') {
  const bounceType = event.status.startsWith('5') ? 'permanent' : 'temporary'

  await db.users.update({ email }, {
    emailBounced: true,
    bounceType,
    bounceReason: event.reason
  })

  // For permanent bounces, prevent future sends
  if (bounceType === 'permanent') {
    await db.users.update({ email }, { emailDisabled: true })
  }
}
```

## Rate Limits

- **Webhook delivery**: No rate limit, but sent in batches
- **Batch size**: Up to 10,000 events per POST
- **Retry schedule**: Exponential backoff (5 min, 10 min, 30 min, 1 hour, 2 hours)
- **Max retries**: 72 hours before giving up

## Common Issues & Solutions

### Issue: Missing Webhooks
**Solution:** Check SendGrid Event Webhook logs for delivery failures, verify endpoint is publicly accessible

### Issue: Duplicate Events
**Solution:** Use `sg_event_id` for deduplication in your database

### Issue: High Latency
**Solution:** Process events asynchronously using a queue (Bull, BullMQ, AWS SQS)

### Issue: Signature Verification Failing
**Solution:** Ensure using raw body for signature verification, check public key is correct

## Resources

- Official Webhook Docs: https://docs.sendgrid.com/for-developers/tracking-events/event
- Event Types Reference: https://docs.sendgrid.com/for-developers/tracking-events/event
- Webhook Security: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook#signed-event-webhook-requests
