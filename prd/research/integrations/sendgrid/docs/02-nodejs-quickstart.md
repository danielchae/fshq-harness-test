# SendGrid Email API Quickstart for Node.js

**Source:** https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs

## Prerequisites

Before starting, ensure you have:

1. **SendGrid Account**: Sign up at SendGrid with a free trial allowing "up to 100 emails per day for 60 days"
2. **Two-Factor Authentication**: Required by Twilio SendGrid for all customers
3. **API Key**: Create a restricted access key with "Mail Send > Full Access" permissions
4. **Sender Identity**: Complete Domain Authentication or Single Sender Verification
5. **Node.js**: Version 12.16.1 or later (the SDK supports versions back to 6)

## Environment Setup

Export your API key:
```bash
export SENDGRID_API_KEY=<Your API Key>
```

**Security Best Practice:** Add to `.gitignore`:
```bash
echo "sendgrid.env" >> .gitignore
echo "export SENDGRID_API_KEY='YOUR_API_KEY'" > sendgrid.env
source ./sendgrid.env
```

## Project Initialization

Create and navigate to your project directory:

```bash
mkdir sendgrid-project
cd sendgrid-project
npm init -y
npm install --save @sendgrid/mail
```

## Sending Your First Email

Create an `index.js` file with this complete code:

```javascript
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const msg = {
  to: 'test@example.com', // Change to your recipient
  from: 'test@example.com', // Change to your verified sender
  subject: 'Sending with SendGrid is Fun',
  text: 'and easy to do anywhere, even with Node.js',
  html: '<strong>and easy to do anywhere, even with Node.js</strong>',
}

sgMail
  .send(msg)
  .then((response) => {
    console.log(response[0].statusCode)
    console.log(response[0].headers)
  })
  .catch((error) => {
    console.error(error)
  })
```

## Running Your Code

Execute the script:
```bash
node index.js
```

A successful send returns a `202` status code. Check your recipient's inbox (including spam folder).

## Key API Components

- **Host**: `https://api.sendgrid.com/v3/`
- **Authentication**: Bearer token in Authorization header
- **Message Object**: Requires `to`, `from`, `subject`, and body (`text` or `html`)

## Advanced Features

### Sending to Multiple Recipients

```javascript
const msg = {
  to: ['recipient1@example.com', 'recipient2@example.com'],
  from: 'sender@example.com',
  subject: 'Multiple Recipients',
  text: 'This goes to multiple people',
}
```

### Sending with Attachments

```javascript
const msg = {
  to: 'recipient@example.com',
  from: 'sender@example.com',
  subject: 'File Attachment',
  text: 'See attached file',
  attachments: [
    {
      content: Buffer.from('attachment content').toString('base64'),
      filename: 'attachment.txt',
      type: 'text/plain',
      disposition: 'attachment',
    }
  ]
}
```

### Using Dynamic Templates

```javascript
const msg = {
  to: 'recipient@example.com',
  from: 'sender@example.com',
  templateId: 'd-f43daeeaef504760851f727007e0b5d0',
  dynamicTemplateData: {
    subject: 'Testing Templates',
    name: 'John Doe',
    city: 'Denver',
  },
}
```

## Error Handling

```javascript
sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent successfully')
  })
  .catch((error) => {
    console.error('Error sending email:')
    if (error.response) {
      console.error(error.response.body)
    }
  })
```

## Common Response Codes

- **202**: Accepted - Email queued for sending
- **400**: Bad Request - Invalid JSON or missing required field
- **401**: Unauthorized - Invalid API key
- **403**: Forbidden - Sender not verified
- **413**: Payload Too Large - Email exceeds 20MB limit
- **429**: Too Many Requests - Rate limit exceeded

## Troubleshooting

1. **403 Forbidden**: Verify sender email address in SendGrid dashboard
2. **401 Unauthorized**: Check API key is correctly set in environment variable
3. **Email in spam**: Configure domain authentication for better deliverability
4. **Rate limiting**: Upgrade plan or implement retry logic with exponential backoff

## Next Steps

- Explore dynamic templates for reusable email designs
- Configure event webhooks for delivery tracking
- Set up email validation to verify recipient addresses
- Review analytics dashboard for delivery metrics
- Implement IP warmup for dedicated IPs (Pro plan and above)

## SDK Documentation

Full Node.js SDK documentation: https://github.com/sendgrid/sendgrid-nodejs
NPM package: https://www.npmjs.com/package/@sendgrid/mail
