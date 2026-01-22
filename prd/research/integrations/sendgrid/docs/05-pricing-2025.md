# SendGrid Pricing Information (2025)

**Source:** https://sendgrid.com/en-us/pricing

## Important Update: Free Tier Changes

**As of May 27, 2025**, SendGrid has retired its permanent free tier. The free plan has been replaced with a 60-day free trial.

### Previous Free Tier (Discontinued)
- 100 emails/day permanently
- No credit card required
- Basic features only

### Current Free Trial (2025)
- 60-day trial period
- Up to 100 emails/day (6,000 total over 60 days)
- Requires credit card for sign-up
- Must upgrade to paid plan after trial ends

## Email API Plans

### Free Trial: $0/month (60 days only)
**Volume:** Up to 100 emails/day (6,000 emails over 60 days)

**Included Features:**
- 1 additional teammate
- 1 event webhook
- Analytics & deliverability optimization
- Email support
- Basic templates
- Sender authentication

**Limitations:**
- Time-limited (60 days only)
- Must upgrade or lose access
- Basic features only

---

### Essentials: Starting at $19.95/month
**Volume:** 3,000 to 700,000 emails/month (scalable)

**Volume-Based Pricing:**
- 50,000 emails: $19.95/month
- 100,000 emails: $34.95/month
- 300,000 emails: $89.95/month
- 700,000 emails: $189.95/month

**Included Features:**
- 1 additional teammate
- 2 event webhooks
- Email validation: 0 included (pay per validation)
- Analytics & reporting
- Dynamic templates
- Sender authentication
- Email support

**Best For:**
- Small to medium applications
- Startups and growing businesses
- Transactional emails only
- Budget-conscious projects

---

### Pro: Starting at $89.95/month
**Volume:** 1.5M to 2.5M emails/month

**Volume-Based Pricing:**
- 100,000 emails: $89.95/month
- 300,000 emails: $249.95/month
- 700,000 emails: $449.95/month
- 1.5M emails: $899.95/month
- 2.5M emails: Custom pricing

**Included Features:**
- 1,000 teammates supported
- 5 event webhooks
- 2,500 email validations included monthly
- Dedicated IP addresses
- Subuser management
- Advanced analytics
- IP warmup automation
- Priority support

**Best For:**
- Medium to large applications
- High-volume senders
- Multiple team members
- Need for dedicated IPs (better deliverability)

---

### Premier: Custom Pricing
**Volume:** 5M+ emails/month

**Features:**
- 1,000 teammates
- 5,000 email validations included
- Multiple dedicated IPs
- Advanced security features
- Custom contract terms
- Dedicated account manager
- SLA guarantees
- Premium support
- Custom onboarding

**Best For:**
- Enterprise applications
- Mission-critical email infrastructure
- Compliance requirements
- Need for SLA guarantees

**Note:** "Need to send more? Talk to us for custom, high volume pricing"

---

## Marketing Campaigns Plans

*(Separate product from Email API)*

### Free Trial: $0/month (60 days only)
- 100 contacts
- Up to 6,000 emails/month
- 1 teammate
- 3 email testing credits

### Basic: Starting at $15/month
- 5,000 contacts
- 15,000 emails/month
- 1 teammate
- 10 testing credits

### Advanced: Starting at $60/month
- 10,000-100,000 contacts
- 30,000-500,000 emails/month
- 1,000 teammates
- 60 testing credits
- Dedicated IP included

### Custom: Custom Pricing
- 500,000+ contacts
- 2.5M+ emails/month
- Enterprise features

---

## Rate Limits & Constraints

### API Rate Limits
- **Web API v3**: No documented hard rate limit, but burst limits apply
- **Recommended**: Space requests appropriately for optimal delivery
- **Essentials/Pro**: Higher burst limits than free tier

### Message Constraints
- **Maximum message size**: 20MB (including headers and attachments)
- **Maximum recipients per request**: 1,000
- **Attachment limit**: 30MB total (compressed)

### Email Validation Limits
- **Free Trial**: 0 validations included
- **Essentials**: Pay per validation (typically $0.0006/email)
- **Pro**: 2,500 included/month
- **Premier**: 5,000 included/month

---

## Cost Analysis for FSHQ.gg

### Estimated Email Volume

**Authentication Emails:**
- Signup verification: ~1,000/month (est.)
- Password resets: ~200/month (est.)

**Transactional Emails:**
- League invitations: ~500/month (est.)
- Notifications: ~800/month (est.)

**Future Growth:**
- Weekly digests: ~4,000/month (if 1,000 active users)

**Total Estimated Volume:** ~6,500 emails/month initially

### Recommended Plan

**Start with: Essentials Plan - $19.95/month (50,000 emails)**

**Rationale:**
- Well within volume limits (6,500 vs 50,000)
- Room for 7x growth before upgrade needed
- 2 event webhooks for delivery tracking
- Cost-effective for startup phase
- Can upgrade to Pro as user base grows

**When to Upgrade to Pro:**
- Exceeding 40,000 emails/month consistently
- Need for dedicated IP (better deliverability at scale)
- Multiple team members managing emails
- Need for included email validation (if validating signups)

---

## Additional Costs

### Email Validation (Optional but Recommended)
- **Cost**: ~$0.0006 per validation
- **Use case**: Validate email addresses at signup to reduce bounces
- **Estimated cost**: $0.60/month for 1,000 signups

### Overage Fees
- **Essentials**: Pay-as-you-go for emails beyond plan limit
- **Typical overage**: Similar to next tier pricing
- **Recommendation**: Upgrade plan before hitting limit

### Domain Authentication (Free)
- **Cost**: $0
- **Requirement**: Configure DNS records
- **Benefit**: Improved deliverability and sender reputation

---

## Comparison with Free Trial

### 60-Day Free Trial Limitations
- ❌ Time-limited (must upgrade or lose access)
- ❌ Only 100 emails/day (may not be enough for testing peak loads)
- ❌ Only 1 webhook (may need separate for bounces vs deliveries)
- ✅ Good for initial development and testing
- ✅ No upfront cost

### Essentials Plan Benefits
- ✅ No time limit
- ✅ 50,000 emails/month (adequate for launch and growth)
- ✅ 2 webhooks (can separate event types)
- ✅ Production-ready
- ✅ Only $19.95/month (reasonable for production service)

---

## Cost-Saving Strategies

1. **Email Validation at Signup**
   - Reduces bounces and improves deliverability
   - Prevents paying for undeliverable emails
   - Protects sender reputation

2. **Batch Similar Emails**
   - Use dynamic templates instead of individual sends
   - Reduces API calls and processing overhead

3. **Monitor and Optimize**
   - Track open rates and engagement
   - Remove inactive users from digest emails
   - Optimize sending times for better engagement

4. **Start with Essentials**
   - Don't overpay for unused volume
   - Upgrade only when consistently approaching limits
   - Use built-in analytics to track usage trends

---

## Key Pricing Insights

1. **No Permanent Free Tier**: Must budget for email from the start (post-trial)
2. **Volume Discounts**: Cost per email decreases significantly at higher tiers
3. **Separate Products**: Email API and Marketing Campaigns are priced separately
4. **Overage Flexibility**: Can exceed plan limits with pay-as-you-go (Essentials)
5. **Free Features**: Domain authentication, basic analytics, and sender verification are free on all plans

---

## Recommended Budget for FSHQ.gg

**Year 1:**
- Months 1-2: Free trial ($0)
- Months 3-12: Essentials 50K plan ($19.95/month × 10 = $199.50)
- **Total Year 1**: ~$200

**Year 2 (with growth):**
- Assuming 3x growth to ~20K emails/month
- Essentials 50K plan: $19.95/month × 12 = $239.40
- **Total Year 2**: ~$240

**Year 3 (continued growth):**
- Assuming growth to ~60K emails/month
- Upgrade to Essentials 100K plan: $34.95/month × 12 = $419.40
- **Total Year 3**: ~$420

**Note:** These are conservative estimates. Actual costs may vary based on user adoption and email frequency preferences.
