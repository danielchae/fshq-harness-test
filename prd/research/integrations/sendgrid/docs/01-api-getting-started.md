# Getting Started with SendGrid API: Complete Guide

**Source:** https://www.twilio.com/docs/sendgrid/for-developers/sending-email/api-getting-started

## Prerequisites

Before sending your first email, you need to:

1. **Create a SendGrid account** at their pricing page
2. **Generate an API Key** from your account settings
3. **Install curl** (pre-installed on Mac systems)

**Important:** Basic Authentication is no longer accepted; you must use an API key.

## Core API Components

Your API requests require three essential elements:

**Host:** All Web API v3 calls target `https://api.sendgrid.com/v3/`

**Authorization Header:** Your API key must be included using Bearer token authentication in the request headers.

**Request Format:** Data submissions via POST or PUT methods must use JSON formatting.

## Sending Your First Email

Here's the fundamental curl command structure:

```bash
curl --request POST \
--url https://api.sendgrid.com/v3/mail/send \
--header 'Authorization: Bearer <<YOUR_API_KEY>>' \
--header 'Content-Type: application/json' \
--data '{
  "personalizations": [
    {
      "to": [{"email": "recipient@example.com"}]
    }
  ],
  "from": {"email": "sender@example.com"},
  "subject": "Hello, World!",
  "content": [
    {
      "type": "text/plain",
      "value": "Hello, World!"
    }
  ]
}'
```

## Important Constraints

- **Message size limit:** 20MB maximum, including headers and attachments
- **Server host recommendation:** Use the full API endpoint rather than hardcoding IP addresses, as SendGrid IPs change periodically

## Implementation Steps

1. Copy the provided curl example
2. Replace `<<YOUR_API_KEY>>` with your actual API key
3. Update recipient email, sender address, subject line, and message content
4. Execute the command in your terminal
5. Check the recipient's inbox (possibly spam folder if authentication isn't configured)

## Response Handling

All responses return in JSON format. The API provides status codes, content-type headers, and pagination options for interpreting responses.

## Available Language Libraries

SendGrid offers official SDKs for:
- PHP
- Python
- Node.js
- Java
- C#
- Go
- Ruby

These SDKs provide alternative implementation approaches with language-specific conveniences.

## Authentication Best Practices

1. **API Key Storage:** Store API keys in environment variables, never hardcode them
2. **Key Permissions:** Use restricted API keys with minimal required permissions
3. **Key Rotation:** Regularly rotate API keys for security
4. **Separate Keys:** Use different API keys for different applications or environments

## Next Steps

- Set up sender authentication (Domain Authentication or Single Sender Verification)
- Explore dynamic templates for reusable email designs
- Configure event webhooks for delivery tracking
- Review analytics and deliverability metrics
