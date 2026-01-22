# Cloudflare Pricing Tiers Comparison

**Sources**:
- https://www.cloudflare.com/plans/
- https://developers.cloudflare.com/workers/platform/pricing/

## Overview

Cloudflare offers four main pricing tiers with varying features for DNS, domain management, CDN, and security services. All plans include unlimited bandwidth for standard website traffic.

## Pricing Tiers

### Free Plan - $0/month

The Free tier provides essential features for small websites and personal projects.

**Core Features:**
- ✅ Unlimited DNS queries
- ✅ Global CDN with unlimited bandwidth*
- ✅ Unmetered DDoS protection
- ✅ Shared SSL certificates
- ✅ Basic Web Application Firewall (WAF) with limited rulesets
- ✅ DNS management (A, AAAA, CNAME, MX, TXT, etc.)
- ✅ DNSSEC support
- ✅ Standard CNAME flattening
- ✅ 3 Page Rules
- ✅ Community support

**API Access:**
- ✅ Full REST API access
- ✅ 1,200 requests per 5 minutes rate limit
- ✅ All DNS API endpoints available

**Limitations:**
- No advanced WAF rules
- Limited analytics
- Shared SSL (no custom certificates)
- No image optimization
- No mobile optimization
- Community support only

**Best For:**
- Personal websites
- Small blogs
- Development/testing environments
- Non-critical applications

*Note: Video and large file delivery is restricted on Free plan

### Pro Plan - $20/month per domain

The Pro plan adds performance optimization and enhanced security features.

**Additional Features (includes all Free features):**
- ✅ Polish image optimization
- ✅ Mirage mobile content optimization
- ✅ Enhanced performance features
- ✅ 20 Page Rules (vs 3 on Free)
- ✅ Web Application Firewall (WAF)
- ✅ Faster DNS propagation
- ✅ Basic analytics

**API Access:**
- ✅ Same API access as Free tier
- ✅ 1,200 requests per 5 minutes

**Pricing:**
- $20/month per website/domain
- Billed monthly or annually
- No additional bandwidth charges

**Best For:**
- Professional websites
- Small e-commerce sites
- Marketing websites
- Business websites with moderate traffic

### Business Plan - $200/month per domain

The Business plan provides advanced security, performance, and reliability features.

**Additional Features (includes all Pro features):**
- ✅ 100% uptime SLA
- ✅ Custom SSL certificates
- ✅ Custom WAF rules
- ✅ Advanced security features
- ✅ 24/7 email and chat support
- ✅ Advanced DDoS protection
- ✅ 50 Page Rules (vs 20 on Pro)
- ✅ Railgun WAN optimization
- ✅ Advanced cache controls
- ✅ Bypass Cache on Cookie
- ✅ Enhanced analytics and reporting
- ✅ PCI compliance support

**API Access:**
- ✅ Same API access as lower tiers
- ✅ 1,200 requests per 5 minutes
- ✅ Priority support for API issues

**Pricing:**
- $200/month per website/domain
- Annual billing available
- No bandwidth charges

**Best For:**
- E-commerce platforms
- Business-critical applications
- High-traffic websites
- Organizations requiring SLA guarantees

### Enterprise Plan - Custom pricing (typically $5,000+/month)

The Enterprise plan offers fully customizable solutions with dedicated support.

**Additional Features (includes all Business features):**
- ✅ Custom pricing based on needs
- ✅ 100% uptime SLA with credits
- ✅ Dedicated account team
- ✅ 24/7 phone + priority email support
- ✅ Advanced security suite
- ✅ Custom WAF and Firewall rules
- ✅ Enhanced rate limiting
- ✅ Custom SSL configurations
- ✅ Advanced load balancing
- ✅ Custom cache rules
- ✅ Internal DNS (private networks)
- ✅ Multi-user access controls
- ✅ Single Sign-On (SSO)
- ✅ Custom contracts
- ✅ HIPAA/PCI/SOC 2 compliance
- ✅ Increased rate limits (negotiable)

**API Access:**
- ✅ Higher rate limits available (negotiable)
- ✅ Dedicated API support
- ✅ Custom integration assistance
- ✅ Registrar API access for domain registration

**Pricing:**
- Custom quotes starting around $5,000/month
- Volume-based pricing available
- Annual contracts required

**Best For:**
- Large enterprises
- Mission-critical applications
- High-security requirements
- Organizations with complex compliance needs

## DNS & Domain-Specific Features by Tier

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| DNS Management | ✅ | ✅ | ✅ | ✅ |
| DNSSEC | ✅ | ✅ | ✅ | ✅ |
| DNS API Access | ✅ | ✅ | ✅ | ✅ Enhanced |
| Standard CNAME Flattening | ✅ | ✅ | ✅ | ✅ |
| Advanced CNAME Flattening | ❌ | ❌ | ✅ | ✅ |
| Secondary DNS | ❌ | ❌ | ✅ | ✅ |
| Internal DNS | ❌ | ❌ | ❌ | ✅ |
| DNS Analytics | Basic | Enhanced | Advanced | Custom |
| Domain Registration API | ❌ | ❌ | ❌ | ✅ |
| DNS Query Rate | Unlimited | Unlimited | Unlimited | Unlimited |

## CDN Features by Tier

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| Global CDN | ✅ | ✅ | ✅ | ✅ |
| Bandwidth | Unlimited* | Unlimited* | Unlimited | Unlimited |
| SSL/TLS | Shared | Shared | Custom | Custom + Advanced |
| Image Optimization | ❌ | Polish | Polish | Polish + Custom |
| Mobile Optimization | ❌ | Mirage | Mirage | Mirage + Custom |
| Page Rules | 3 | 20 | 50 | Custom |
| Cache Analytics | Basic | Enhanced | Advanced | Custom |
| Custom Cache Rules | Limited | Enhanced | Advanced | Unlimited |

*Restrictions on video and large file delivery

## API Rate Limits by Tier

| Tier | Rate Limit | Notes |
|------|-----------|-------|
| Free | 1,200 req/5min | Per user, all methods combined |
| Pro | 1,200 req/5min | Same as Free |
| Business | 1,200 req/5min | Priority API support |
| Enterprise | Negotiable | Custom limits available |

**Note**: All tiers share the same base rate limit of 1,200 requests per 5 minutes per user. Enterprise customers can negotiate higher limits.

## Workers Pricing (Relevant for API Automation)

### Workers Free
- 100,000 requests per day
- Limited CPU time
- Workers KV: 100,000 reads/day

### Workers Paid - $5/month minimum
- 10 million requests included
- $0.50 per additional million
- Unlimited CPU time
- Workers KV: $0.50 per million reads
- No egress/bandwidth charges

## Cloudflare Registrar (Add-on)

Domain registration available at wholesale prices (no markup):
- Pay only ICANN fees + registry costs
- Free WHOIS privacy
- Automatic DNS integration
- Available on all plan tiers
- No API for registration (except Enterprise)

## Key Value Propositions

### Free Plan Value
- **Cost-per-GB**: $0 (effectively unlimited for standard usage)
- **Best for**: Many users report running 2-5TB/month on Free tier
- **DDoS Protection**: Enterprise-grade included
- **API Access**: Full REST API available

### Pro Plan Value
- **Performance**: Image and mobile optimization worth the cost
- **Only $20/month**: Much cheaper than competitors
- **ROI**: Significant for image-heavy sites

### Business Plan Value
- **SLA**: 100% uptime guarantee with credits
- **Advanced Security**: Custom WAF rules
- **Railgun**: Significant performance boost for dynamic content
- **PCI Compliance**: Required for many e-commerce sites

### Enterprise Plan Value
- **Customization**: Tailored to specific needs
- **Support**: Dedicated team and phone support
- **Compliance**: HIPAA, SOC 2, custom requirements
- **Scale**: Negotiable rate limits and features

## Recommendation for FSHQ.gg

Based on the project requirements:

**Recommended Tier: Free or Pro**

**Free Plan is sufficient if:**
- Only DNS management needed (fshq.gg/LEAGUESLUG routing)
- No need for image optimization
- Traffic is primarily text/HTML
- Community support is acceptable
- No SLA required

**Pro Plan recommended if:**
- Image optimization desired (league logos, player avatars)
- Mobile users are significant
- Want faster support response
- Need enhanced analytics

**Business/Enterprise NOT needed unless:**
- Require SLA guarantees
- Need PCI compliance
- Want custom SSL certificates
- Require phone support
- Need domain registration API (Enterprise only)

## Cost Calculation for FSHQ.gg

**Scenario 1: Free Plan**
- Monthly cost: $0
- Domain registration: ~$10-15/year (via Cloudflare Registrar)
- Total first year: ~$10-15

**Scenario 2: Pro Plan**
- Monthly cost: $20/month = $240/year
- Domain registration: ~$10-15/year
- Total first year: ~$250-255

**Scenario 3: Business Plan**
- Monthly cost: $200/month = $2,400/year
- Domain registration: ~$10-15/year
- Total first year: ~$2,410-2,415

The Free plan provides excellent value and includes all necessary DNS features for the FSHQ.gg project's stated requirements.
