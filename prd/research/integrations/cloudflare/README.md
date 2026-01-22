# Cloudflare Domain & DNS Management Integration Research

**Integration Type**: Domain & DNS Management
**Primary Use Case**: Managing fshq.gg domain and league-specific URLs (fshq.gg/LEAGUESLUG)
**Documentation Date**: 2025-12-05
**Research Status**: ✅ Complete

## Executive Summary

Cloudflare is a comprehensive DNS and CDN platform that provides authoritative DNS services, domain registration (via Cloudflare Registrar), DDoS protection, and optional CDN features. For the FSHQ.gg project, Cloudflare will serve as the primary DNS provider for managing the fshq.gg domain and enabling league-specific URL routing through DNS records and/or page rules.

The integration can be implemented at two levels:
1. **Administrative Dashboard** (recommended for initial setup): No programming required, manual DNS record management
2. **Programmatic API Integration** (optional for automation): Full REST API for automated DNS management

**Key Finding**: Cloudflare's Free tier includes all necessary DNS features for FSHQ.gg, including unlimited DNS queries, API access, DNSSEC, and DDoS protection at no cost. Programmatic API integration is available on all tiers but may not be required unless automated DNS management is needed.

## Integration Capabilities & Features

### Core DNS Management

Cloudflare provides enterprise-grade authoritative DNS services with the following capabilities:

1. **DNS Record Management**: Full support for 21+ DNS record types including A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, and others. Records can be managed through both web dashboard and REST API.

2. **DNSSEC Support**: DNS Security Extensions with cryptographic signatures to prevent DNS spoofing, traffic redirection, and man-in-the-middle attacks. Supports both standard and multi-signer DNSSEC configurations.

3. **CNAME Flattening**: Enables CNAME records at apex domains (fshq.gg) while maintaining performance. Business/Enterprise plans offer advanced CNAME flattening for all subdomains.

4. **Anycast Network**: Global DNS infrastructure ensures fast resolution times and high availability across 300+ data centers worldwide.

5. **DDoS Protection**: Automatic mitigation of DNS-targeted DDoS attacks without user intervention, protecting domain availability.

### Domain Registration (Cloudflare Registrar)

Cloudflare offers domain registration at wholesale pricing with no markup:
- Pay only ICANN fees and registry costs (~$10-15/year for .gg domains)
- Free WHOIS privacy protection
- Automatic DNS integration upon registration
- Domain management through dashboard
- **Note**: Domain registration API is available only to Enterprise customers

### CDN & Proxy Features (Optional)

While not strictly DNS-related, Cloudflare's CDN capabilities integrate seamlessly with DNS:

1. **Proxy Status Control**: A, AAAA, and CNAME records can be "proxied" (orange cloud) to route traffic through Cloudflare's CDN for:
   - SSL/TLS encryption
   - DDoS protection
   - Web Application Firewall (WAF)
   - Caching and performance optimization
   - Real IP address hiding

2. **Page Rules**: Configure custom behaviors for specific URL patterns (e.g., fshq.gg/LEAGUESLUG/*) including redirects, caching rules, SSL modes, and forwarding.

3. **Load Balancing**: Geographic and performance-based traffic distribution (Business/Enterprise plans).

### API Capabilities

Cloudflare provides a comprehensive REST API for DNS management:

**Core DNS Endpoints**:
- `GET /zones/{zone_id}/dns_records` - List all DNS records
- `POST /zones/{zone_id}/dns_records` - Create new records
- `PATCH /zones/{zone_id}/dns_records/{id}` - Update existing records
- `DELETE /zones/{zone_id}/dns_records/{id}` - Remove records
- `POST /zones/{zone_id}/dns_records/batch` - Batch operations

**Advanced Operations**:
- BIND file import/export
- Asynchronous DNS record scanning
- DNSSEC configuration management
- Zone transfer management (secondary DNS)
- DNS analytics and query statistics

**See**: [`docs/dns-api-reference.md`](docs/dns-api-reference.md) for complete API endpoint documentation.

## Authentication Methods & Requirements

Cloudflare supports two authentication methods, with API Tokens being strongly recommended over legacy API Keys.

### API Tokens (Recommended)

Modern, secure authentication with fine-grained permissions:

**Creation Process**:
1. Navigate to Cloudflare Dashboard
2. Go to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Select permissions (e.g., "DNS Read" + "DNS Write")
5. Optionally restrict by IP address and/or expiration time

**Security Features**:
- Scoped to specific zones and permissions
- Can restrict to specific IP addresses
- Supports time-to-live (TTL) with `not_before` and `expires_on`
- Can be revoked individually without affecting other tokens
- Maximum 50 tokens per user, 500 per account

**Usage**:
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
```

### API Keys (Legacy)

Global API keys provide full account access but lack security features:
- Cannot be scoped to specific zones or permissions
- No IP restrictions or expiration options
- Higher security risk if compromised
- **Not recommended** for new integrations

**Usage**:
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "X-Auth-Email: your-email@example.com" \
     -H "X-Auth-Key: YOUR_API_KEY"
```

**See**: [`docs/authentication-and-rate-limits.md`](docs/authentication-and-rate-limits.md) for complete authentication documentation.

## Rate Limits & API Quotas

### Global Rate Limit

**Primary Limit**: 1,200 requests per 5-minute period per user

This limit applies:
- **Per User**: Not per token, zone, or account
- **Across All Methods**: Dashboard, API token, and API key usage combined
- **Cumulatively**: All API operations count toward the same quota

**Exceeded Limit Response**: Returns `HTTP 429 - Too Many Requests` and blocks all API calls for the next 5 minutes.

### Additional Limits

- **Per-IP Throttling**: 200 requests per second for Client API
- **GraphQL API**: Maximum 320 requests per 5-minute window (complexity-based)
- **Token Creation**: Up to 50 API tokens per user, 500 per account

### Rate Limit Headers

REST API responses include monitoring headers:
- `Ratelimit`: Remaining quota and reset time
- `Ratelimit-Policy`: Total quota and time window
- `retry-after`: Seconds until capacity restores (when limit exceeded)

### Enterprise Options

Enterprise customers can request increased rate limits by contacting Cloudflare Support.

**Practical Impact for FSHQ.gg**:
- 1,200 requests per 5 minutes = 14,400 requests per hour
- For DNS management: More than sufficient for typical operations
- For automated workflows: May require rate limit handling and retry logic
- Dashboard usage (manual DNS changes): No rate limit concerns

**See**: [`docs/authentication-and-rate-limits.md`](docs/authentication-and-rate-limits.md) for complete rate limiting details.

## Pricing Structure

Cloudflare offers four pricing tiers, all with unlimited DNS queries and bandwidth (for standard website traffic).

### Free Plan - $0/month ✅ Recommended for FSHQ.gg

**Included Features**:
- ✅ Unlimited DNS queries and bandwidth
- ✅ Full DNS management (all record types)
- ✅ Complete REST API access (same 1,200 req/5min limit)
- ✅ DNSSEC support
- ✅ Unmetered DDoS protection
- ✅ Shared SSL certificates
- ✅ Basic WAF with limited rulesets
- ✅ 3 Page Rules (for URL routing)
- ✅ Global CDN access
- ✅ Community support

**Limitations**:
- Video/large file delivery restrictions
- No advanced WAF rules
- Shared SSL only (no custom certificates)
- No image/mobile optimization
- Community support only

**Verdict**: Perfect for FSHQ.gg's DNS and basic CDN needs at zero cost.

### Pro Plan - $20/month per domain

**Additional Features**:
- Polish image optimization
- Mirage mobile content optimization
- 20 Page Rules (vs 3)
- Enhanced WAF
- Faster support response
- Enhanced analytics

**Use Case**: Worth considering if FSHQ.gg serves significant images (league logos, player avatars) or has large mobile traffic.

### Business Plan - $200/month per domain

**Additional Features**:
- 100% uptime SLA
- Custom SSL certificates
- Custom WAF rules
- 24/7 email/chat support
- 50 Page Rules
- Railgun WAN optimization
- Advanced cache controls
- PCI compliance support

**Use Case**: Only needed if SLA guarantees or PCI compliance required.

### Enterprise Plan - Custom pricing (typically $5,000+/month)

**Additional Features**:
- Custom pricing and contracts
- Dedicated account team
- 24/7 phone support
- Higher API rate limits (negotiable)
- **Domain Registration API** (only available on Enterprise)
- Internal DNS for private networks
- Advanced security suite
- Custom SSL and load balancing
- SSO and multi-user access controls

**Use Case**: Not recommended for FSHQ.gg unless extreme scale or compliance requirements emerge.

### API Access by Tier

| Feature | Free | Pro | Business | Enterprise |
|---------|------|-----|----------|------------|
| REST API Access | ✅ Full | ✅ Full | ✅ Full | ✅ Enhanced |
| Rate Limit | 1,200/5min | 1,200/5min | 1,200/5min | Negotiable |
| DNS API | ✅ | ✅ | ✅ | ✅ |
| Domain Registration API | ❌ | ❌ | ❌ | ✅ |
| API Support | Community | Email | Priority | Dedicated |

**Cost Estimate for FSHQ.gg**:
- **Free Plan**: $0/month + domain registration (~$10-15/year) = **~$10-15/year total**
- **Pro Plan**: $20/month + domain (~$10-15/year) = **~$250-255/year total**

**See**: [`docs/pricing-tiers-comparison.md`](docs/pricing-tiers-comparison.md) for detailed pricing comparison.

## Integration Complexity Assessment

### Level 1: Dashboard-Only Management (Low Complexity) ⭐⭐

**Recommended for**: Initial setup and manual DNS management

**Setup Time**: 30-60 minutes
**Technical Skills Required**: Basic web navigation, understanding of DNS concepts
**Maintenance**: Manual updates via web dashboard

**Implementation Steps**:
1. Create Cloudflare account (5 minutes)
2. Add fshq.gg domain to Cloudflare (5 minutes)
3. Update domain nameservers at registrar to Cloudflare's nameservers (5 minutes)
4. Wait for DNS propagation (up to 24 hours, typically 1-2 hours)
5. Configure DNS records via dashboard:
   - A record for fshq.gg → server IP
   - CNAME records for subdomains (www, api, etc.)
   - TXT records for verification if needed
6. Optional: Enable DNSSEC (5 minutes)
7. Optional: Configure Page Rules for /LEAGUESLUG routing (10 minutes)

**Pros**:
- No programming required
- Visual interface is intuitive
- Immediate feedback and validation
- Easy to troubleshoot
- Suitable for non-technical team members

**Cons**:
- Manual updates required for DNS changes
- No automation for league-specific URLs
- Cannot integrate with application logic
- Slower for bulk operations

**Best For**: FSHQ.gg if DNS changes are infrequent and manual management is acceptable.

### Level 2: Programmatic API Integration (Medium Complexity) ⭐⭐⭐

**Recommended for**: Automated DNS management, dynamic league URL creation

**Setup Time**: 4-8 hours initial development + testing
**Technical Skills Required**: Backend programming (Node.js, Python, Go, or PHP), REST API integration, async programming
**Maintenance**: Automated, requires monitoring

**Implementation Steps**:
1. Complete Level 1 setup (dashboard configuration)
2. Create API Token with DNS Read + DNS Write permissions (5 minutes)
3. Choose and install official SDK:
   - **Node.js/TypeScript**: `npm install cloudflare`
   - **Python**: `pip install cloudflare`
   - **Go**: `go get github.com/cloudflare/cloudflare-go/v2`
   - **PHP**: `composer require cloudflare/sdk`
4. Implement DNS management functions:
   - Create DNS record for new league
   - Update existing records
   - Delete records for removed leagues
   - List and search records
5. Implement rate limit handling (exponential backoff)
6. Add error handling and retry logic
7. Write integration tests
8. Deploy to production
9. Monitor API usage and errors

**Example Implementation** (Node.js/TypeScript):
```typescript
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
});

async function createLeagueSubdomain(leagueSlug: string, serverIP: string) {
  try {
    const record = await client.dns.records.create({
      zone_id: process.env.CLOUDFLARE_ZONE_ID,
      type: 'CNAME',
      name: leagueSlug, // e.g., "league1" for league1.fshq.gg
      content: 'fshq.gg', // Points to main domain
      ttl: 3600,
      proxied: true, // Enable CDN and DDoS protection
    });
    console.log(`Created DNS record for ${leagueSlug}.fshq.gg`);
    return record;
  } catch (error) {
    if (error.status === 429) {
      // Rate limit hit, retry after delay
      console.error('Rate limit exceeded, retrying...');
      await sleep(60000); // Wait 60 seconds
      return createLeagueSubdomain(leagueSlug, serverIP);
    }
    throw error;
  }
}
```

**Pros**:
- Fully automated DNS management
- Can integrate with application workflows
- Supports bulk operations
- Enables dynamic league URL creation
- Version-controlled infrastructure
- Programmatic monitoring and alerting

**Cons**:
- Requires development time
- Must handle rate limits and errors
- Needs ongoing maintenance
- Adds complexity to application
- Requires secure credential management

**Best For**: FSHQ.gg if leagues are created/deleted frequently or DNS changes need to be automated.

### Decision Matrix for FSHQ.gg

| Scenario | Recommended Approach | Rationale |
|----------|---------------------|-----------|
| Static domain with infrequent DNS changes | Dashboard-Only (Level 1) | Simplest, no development needed |
| Frequent league creation/deletion | Programmatic API (Level 2) | Automation saves time and reduces errors |
| URL routing via path (fshq.gg/LEAGUESLUG) | Dashboard + Application Routing | DNS not needed for path-based routing |
| URL routing via subdomain (league.fshq.gg) | Programmatic API (Level 2) | Dynamic subdomain creation requires API |

**Recommended for FSHQ.gg**: Start with **Dashboard-Only (Level 1)** for initial setup and manual DNS management. Upgrade to **Programmatic API (Level 2)** only if:
1. Leagues are created/deleted frequently (multiple times per week)
2. Subdomain-based routing is required (league.fshq.gg vs fshq.gg/league)
3. DNS management needs to be integrated with application logic

**Important Note**: If FSHQ.gg uses path-based routing (fshq.gg/LEAGUESLUG), DNS configuration is a one-time setup. URL routing should be handled by the application server (Next.js, Express, etc.), not DNS/Cloudflare.

## Official Documentation & Resources

### Official Cloudflare Documentation

1. **API Documentation** (Primary Resource)
   - URL: https://developers.cloudflare.com/api/
   - Content: Complete API reference, authentication guide, getting started
   - **Most Helpful**: Start here for API integration

2. **DNS API Reference**
   - URL: https://developers.cloudflare.com/api/resources/dns/
   - Content: All DNS endpoints, request/response formats, examples
   - **Most Helpful**: Required for DNS programming

3. **DNS Management Guide**
   - URL: https://developers.cloudflare.com/dns/
   - Content: DNS features, DNSSEC, CNAME flattening, best practices
   - **Most Helpful**: Understanding Cloudflare's DNS capabilities

4. **Rate Limits Reference**
   - URL: https://developers.cloudflare.com/fundamentals/api/reference/limits/
   - Content: Rate limits, quotas, headers, enterprise options
   - **Most Helpful**: Required for API integration planning

5. **DNS Record Creation Guide**
   - URL: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/
   - Content: Step-by-step guide for dashboard and API
   - **Most Helpful**: Dashboard setup walkthrough

### Official SDK Repositories (GitHub)

All SDKs are actively maintained, generated from OpenAPI spec, and include full TypeScript/type definitions:

1. **TypeScript/Node.js SDK**
   - Repository: https://github.com/cloudflare/cloudflare-typescript
   - Install: `npm install cloudflare`
   - **Most Helpful**: If backend is Node.js/TypeScript

2. **Python SDK**
   - Repository: https://github.com/cloudflare/cloudflare-python
   - Install: `pip install cloudflare`
   - **Most Helpful**: If backend is Python (Django, Flask, FastAPI)

3. **Go SDK**
   - Repository: https://github.com/cloudflare/cloudflare-go
   - Install: `go get github.com/cloudflare/cloudflare-go/v2`
   - **Most Helpful**: If backend is Go (high-performance microservices)

4. **PHP SDK**
   - Repository: https://github.com/cloudflare/cloudflare-php
   - Install: `composer require cloudflare/sdk`
   - **Most Helpful**: If backend is PHP (Laravel, Symfony)

5. **Cloudflare Main Organization**
   - Repository: https://github.com/cloudflare
   - Content: 527+ repositories, tools, examples, documentation
   - **Most Helpful**: Exploring additional tools and examples

**See**: [`docs/official-sdks-and-libraries.md`](docs/official-sdks-and-libraries.md) for SDK usage examples and features.

### Community Resources

1. **Cloudflare Community Forum**
   - URL: https://community.cloudflare.com/
   - Content: Q&A, troubleshooting, community support

2. **Community Libraries**
   - Java: https://github.com/robinbraemer/CloudflareAPI
   - Lightweight JS: https://github.com/kriasoft/cloudflare-client

### Pricing & Plans

- **Pricing Page**: https://www.cloudflare.com/plans/
- **Workers Pricing**: https://developers.cloudflare.com/workers/platform/pricing/

## Research Documentation Files

This research package includes the following detailed documentation files in the [`docs/`](docs/) directory:

1. **[`dns-api-reference.md`](docs/dns-api-reference.md)** (Required for API integration)
   - Complete DNS API endpoint reference
   - Request/response formats and examples
   - Supported record types and constraints
   - Batch operations and import/export
   - Authentication requirements

2. **[`authentication-and-rate-limits.md`](docs/authentication-and-rate-limits.md)** (Required for API integration)
   - API Token creation and management
   - API Key comparison (legacy)
   - Rate limit details and headers
   - Token quotas and restrictions
   - Best practices and error handling

3. **[`dns-service-features.md`](docs/dns-service-features.md)** (Required for understanding capabilities)
   - Cloudflare DNS service overview
   - DNSSEC, CNAME flattening, DDoS protection
   - Dashboard and API record creation
   - Plan availability and feature comparison
   - Advanced features (secondary DNS, analytics)

4. **[`official-sdks-and-libraries.md`](docs/official-sdks-and-libraries.md)** (Required for implementation)
   - TypeScript, Python, Go, PHP SDK documentation
   - Installation and usage examples
   - Common SDK features (auto-pagination, error handling)
   - GitHub repository links
   - SDK selection guidance

5. **[`pricing-tiers-comparison.md`](docs/pricing-tiers-comparison.md)** (Required for budgeting)
   - Detailed comparison of Free, Pro, Business, Enterprise plans
   - Feature matrix for DNS, CDN, and API access
   - API rate limits by tier
   - Cost calculations for FSHQ.gg scenarios
   - Workers pricing (for automation)

**Most Important Files for FSHQ.gg**:
- Start with [`dns-service-features.md`](docs/dns-service-features.md) to understand capabilities
- Review [`pricing-tiers-comparison.md`](docs/pricing-tiers-comparison.md) to confirm Free plan sufficiency
- If API integration needed: [`authentication-and-rate-limits.md`](docs/authentication-and-rate-limits.md) and [`dns-api-reference.md`](docs/dns-api-reference.md)
- If implementing: [`official-sdks-and-libraries.md`](docs/official-sdks-and-libraries.md) for SDK selection and examples

## Implementation Recommendations for FSHQ.gg

### Immediate Next Steps (Phase 1: Dashboard Setup)

1. **Create Cloudflare Account** (Free tier)
   - Register at https://dash.cloudflare.com/sign-up
   - Verify email address

2. **Add fshq.gg Domain**
   - Click "Add Site" in dashboard
   - Enter fshq.gg domain
   - Select Free plan

3. **Update Nameservers at Domain Registrar**
   - Copy Cloudflare's provided nameservers (e.g., ava.ns.cloudflare.com)
   - Log into .gg domain registrar
   - Replace existing nameservers with Cloudflare's nameservers
   - Wait for propagation (typically 1-2 hours, up to 24 hours)

4. **Configure DNS Records**
   - Create A record: `fshq.gg` → `[server-ip-address]`
   - Create CNAME: `www` → `fshq.gg`
   - Create CNAME: `api` → `fshq.gg` (if separate API subdomain needed)
   - Enable "Proxied" status (orange cloud) for DDoS protection and SSL

5. **Enable DNSSEC** (Recommended)
   - Go to DNS → Settings → DNSSEC
   - Click "Enable DNSSEC"
   - Add DS record at domain registrar (Cloudflare provides instructions)

6. **Configure SSL/TLS**
   - Go to SSL/TLS → Overview
   - Select "Full" or "Full (strict)" mode
   - Free SSL certificate auto-provisioned

### Future Considerations (Phase 2: Optional API Integration)

**Evaluate Need for Programmatic API**:
- If league creation/deletion becomes frequent (multiple times per week)
- If subdomain-based routing is required (league.fshq.gg)
- If DNS changes need to be integrated with application workflows

**If API Integration Decided**:
1. Create API Token with DNS Read + DNS Write permissions
2. Choose SDK based on backend language (TypeScript, Python, Go, PHP)
3. Implement DNS management functions with rate limit handling
4. Add to application deployment pipeline
5. Monitor API usage and errors

### Path-Based Routing (fshq.gg/LEAGUESLUG)

**Important**: If FSHQ.gg uses path-based routing (recommended), DNS is a one-time setup. URL routing should be handled by application server:

**Next.js Example**:
```typescript
// pages/[leagueSlug]/index.tsx
export async function getServerSideProps({ params }) {
  const { leagueSlug } = params;
  const league = await fetchLeagueData(leagueSlug);
  return { props: { league } };
}
```

**Express.js Example**:
```javascript
app.get('/:leagueSlug', async (req, res) => {
  const { leagueSlug } = req.params;
  const league = await fetchLeagueData(leagueSlug);
  res.render('league', { league });
});
```

No Cloudflare API integration needed for path-based routing.

## Summary & Key Takeaways

1. **Cloudflare is Ideal for FSHQ.gg**: Free tier includes all necessary DNS features with unlimited queries and API access at no cost.

2. **Dashboard Sufficient for Initial Setup**: Manual DNS management through web dashboard is simple, fast, and requires no programming.

3. **API Integration Optional**: Only needed if DNS changes are frequent, subdomain routing is required, or automation is desired. API access is available on Free tier.

4. **No Vendor Lock-in**: Standard DNS protocols allow easy migration to other providers if needed. Export BIND files for backups.

5. **Path-Based Routing Recommended**: Use application-level routing (fshq.gg/LEAGUESLUG) instead of DNS-based routing (league.fshq.gg) to avoid API integration complexity.

6. **Excellent Free Tier**: Cloudflare's Free plan includes enterprise-grade features (DNSSEC, DDoS protection, global CDN) that competitors charge for.

7. **Well-Documented**: Comprehensive official documentation, multiple SDKs, and active community support.

8. **Rate Limits Manageable**: 1,200 requests per 5 minutes is sufficient for typical DNS management operations.

9. **Future-Proof**: Can upgrade to Pro/Business plans if image optimization, SLA, or advanced features become necessary.

10. **Estimated Cost**: $0-15/year (Free plan + domain registration) or $250-255/year (Pro plan for enhanced features).

---

## Research Sources

This research was compiled from the following authoritative sources:

### Official Documentation
- [Cloudflare API Overview](https://developers.cloudflare.com/api/)
- [Cloudflare DNS API Reference](https://developers.cloudflare.com/api/resources/dns/)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [API Rate Limits](https://developers.cloudflare.com/fundamentals/api/reference/limits/)
- [DNS Record Management](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)

### Official SDKs
- [TypeScript SDK](https://github.com/cloudflare/cloudflare-typescript)
- [Python SDK](https://github.com/cloudflare/cloudflare-python)
- [Go SDK](https://github.com/cloudflare/cloudflare-go)
- [PHP SDK](https://github.com/cloudflare/cloudflare-php)
- [Cloudflare GitHub Organization](https://github.com/cloudflare)

### Pricing & Comparisons
- [Cloudflare Pricing Plans](https://www.cloudflare.com/plans/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Free vs Paid Analysis](https://www.uptle.com/en/cloudflare-free-vs-pro-vs-business-vs-enterprise)
- [CDN Pricing Comparison](https://blog.blazingcdn.com/en-us/cloudflare-free-vs-paid-plans-which-one-suits-your-needs)

### Community Resources
- [Cloudflare Community Forum](https://community.cloudflare.com/)
- [Tech Otaku - Using Cloudflare API](https://www.tech-otaku.com/web-development/using-cloudflare-api-manage-dns-records/)
- [Reintech - DNS Automation Guide](https://reintech.io/blog/automating-dns-management-cloudflare-api)
