# Dynamic Templates Guide: SendGrid

**Source:** https://www.twilio.com/docs/sendgrid/ui/sending-email/how-to-send-an-email-with-dynamic-templates

## Overview

SendGrid's dynamic templates enable personalized transactional emails through a structured process combining template design with API integration. This is essential for authentication emails, password resets, league invites, and notification emails.

## Core Process

**Template Creation Workflow:**
1. Access the Dynamic Templates page in SendGrid dashboard
2. Create a template container (receives unique ID starting with `d-`)
3. Add versions to that template for different content variations
4. Design using either visual or code editor
5. Activate desired version for sending

## Template Design Features

The design editor offers three primary capabilities:
- **Drag-and-drop modules** for visual email building
- **Global styling controls** for colors/fonts
- **Advanced HTML import/export options** for custom designs

Templates support the "Handlebars templating language for text, HTML, and subject lines."

**Essential Component:** Every template requires an unsubscribe module. Configure it to route unsubscribes to specific groups.

## Dynamic Data Integration

Pass personalized content via the `dynamic_template_data` JSON object in your API request. The payload structure maps Handlebars variables to your JSON keys.

### Handlebars Syntax Examples

**Variable insertion:**
```handlebars
Hello {{name}}!
```
Renders: "Hello John!" (if `name: "John"`)

**Loops:**
```handlebars
{{#each items}}
  <div>
    <img src="{{this.image}}" />
    <p>{{this.text}}</p>
    <span>{{this.price}}</span>
  </div>
{{/each}}
```

**Conditionals:**
```handlebars
{{#if name}}
  <div>Hello {{name}}!</div>
{{else}}
  <div>Hello there!</div>
{{/if}}
```

**Nested objects:**
```handlebars
{{user.firstName}} {{user.lastName}}
```

## API Implementation

### Node.js Example

```javascript
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const msg = {
  to: 'recipient@example.com',
  from: 'sender@example.com',
  templateId: 'd-f43daeeaef504760851f727007e0b5d0',
  dynamicTemplateData: {
    subject: 'Your League Invitation',
    userName: 'John Doe',
    leagueName: 'Champions League 2025',
    inviteLink: 'https://fshq.gg/invite/abc123',
    expiryDate: '2025-12-31'
  },
}

sgMail.send(msg)
  .then(() => console.log('Email sent'))
  .catch(error => console.error(error))
```

### cURL Example

```bash
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "personalizations": [{
      "to": [{"email": "recipient@example.com"}],
      "dynamic_template_data": {
        "userName": "John Doe",
        "leagueName": "Champions League"
      }
    }],
    "from": {"email": "sender@example.com"},
    "template_id": "d-f43daeeaef504760851f727007e0b5d0"
  }'
```

## Testing Templates

SendGrid provides a Test Data tab in the template editor where you can:
1. Write or drop JSON test data
2. View side-by-side preview of rendered email
3. Test all Handlebars logic before sending
4. Verify dynamic content displays correctly

**Example Test Data:**
```json
{
  "userName": "Test User",
  "leagueName": "Test League",
  "inviteLink": "https://fshq.gg/invite/test123",
  "expiryDate": "2025-12-31"
}
```

## Template Versioning

- Create multiple versions of a template for A/B testing or updates
- Only one version is "active" at a time
- Switch active version without changing template ID
- Previous versions remain available for rollback
- No disruption to existing API integrations when updating

## Common Template Use Cases for FSHQ.gg

### 1. Signup Verification Email
```handlebars
Subject: Verify your FSHQ.gg account

Hello {{userName}}!

Welcome to FSHQ.gg! Please verify your email address by clicking:

{{verificationLink}}

This link expires in {{expiryHours}} hours.
```

### 2. Password Reset Email
```handlebars
Subject: Password Reset Request

Hi {{userName}},

We received a request to reset your password. Click below:

{{resetLink}}

If you didn't request this, ignore this email.
Link expires: {{expiryTime}}
```

### 3. League Invitation Email
```handlebars
Subject: You're invited to {{leagueName}}!

Hey {{userName}},

{{inviterName}} invited you to join {{leagueName}}!

{{#if leagueDescription}}
About the league: {{leagueDescription}}
{{/if}}

Accept invitation: {{inviteLink}}

League starts: {{startDate}}
```

### 4. Weekly Digest Email
```handlebars
Subject: Your FSHQ.gg Weekly Summary

Hi {{userName}},

Here's your week in review:

{{#each leagues}}
  <h3>{{this.name}}</h3>
  <p>Your rank: {{this.rank}}</p>
  <p>Points: {{this.points}}</p>
{{/each}}

View full dashboard: {{dashboardLink}}
```

## Prerequisites

- Active Twilio SendGrid account
- Valid API key with Mail Send permissions
- Verified sender email or domain
- Optional: configured unsubscribe group

## Best Practices

1. **Test thoroughly**: Use test data feature before going live
2. **Keep templates simple**: Avoid complex logic in Handlebars
3. **Fallback values**: Use `{{variable "default"}}` for optional data
4. **Mobile responsive**: Test on multiple devices
5. **Plain text version**: Always include text alternative to HTML
6. **Unsubscribe link**: Required for all marketing emails
7. **Version control**: Document template changes and maintain history

## Resource Reference

Sample templates (receipts, password resets, account activations) are available in the SendGrid email-templates GitHub repository:
https://github.com/sendgrid/email-templates/tree/main/dynamic-templates

## Template Design Tools

- **Design Editor**: Drag-and-drop visual editor
- **Code Editor**: HTML/CSS for custom designs
- **Template Library**: Pre-built templates to customize
- **Preview Mode**: Test rendering with sample data
- **Version History**: Track and rollback changes
