# Cloudflare DNS Service Features

**Sources**:
- https://developers.cloudflare.com/dns/
- https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/

## Core Service Description

Cloudflare DNS provides an authoritative DNS platform designed for business domain management. The service emphasizes "fast, resilient and easy-to-manage" operations while leveraging Cloudflare's global infrastructure for optimal performance.

## Key Features

### DNS Records Management

Organizations can configure domain resources and services (like email, web hosting, subdomains) through DNS record creation and management.

**Record Management Options:**
1. **Dashboard Interface**: Web-based GUI for record management
2. **API Integration**: Programmatic record control via REST API
3. **Terraform Provider**: Infrastructure-as-code DNS management
4. **Batch Operations**: Bulk record modifications

### DNSSEC Protection

The platform implements DNS Security Extensions (DNSSEC), adding cryptographic signatures to DNS records. This prevents unauthorized traffic redirection attempts.

**DNSSEC Features:**
- Standard DNSSEC configuration
- Multi-signer DNSSEC support
- Automatic key rotation
- DS record management

**Benefits:**
- Protection against DNS spoofing
- Verification of DNS response authenticity
- Prevention of man-in-the-middle attacks

### CNAME Flattening

This capability enables CNAME records at apex domains (example.com) while improving performance.

**Standard CNAME Flattening** (All Plans):
- Automatically flattens CNAME records at root domain
- Improves DNS resolution speed
- Maintains CNAME flexibility

**Advanced CNAME Flattening** (Premium Plans):
- Flatten all CNAME records across entire domain
- Enhanced performance for complex DNS setups
- Better control over DNS resolution

### Proxy Status Control

For A, AAAA, and CNAME records, users can choose whether to route traffic through Cloudflare's proxy:

**Proxied (Orange Cloud)**:
- Traffic routed through Cloudflare CDN
- DDoS protection enabled
- SSL/TLS encryption
- WAF protection available
- Real IP addresses hidden

**DNS Only (Grey Cloud)**:
- Direct DNS resolution
- No CDN caching
- Real IP exposed
- Suitable for non-HTTP services

## Security & Reliability

### DDoS Protection

The service protects against Distributed Denial of Service attacks targeting DNS infrastructure:
- Anycast network absorbs attack traffic
- Automatic mitigation without user intervention
- No DNS downtime during attacks

### Route Leak & Hijacking Protection

Safeguards domains from common network threats:
- BGP route validation
- Monitoring for unauthorized route announcements
- Protection against DNS hijacking attempts

## DNS Record Creation

### Dashboard Method

Steps to add DNS records through the Cloudflare dashboard:

1. Navigate to **DNS** → **Records** page in your Cloudflare account
2. Click **Add record**
3. Select desired record type (A, AAAA, CNAME, MX, TXT, etc.)
4. Fill in required fields (varies by record type):
   - **Name**: Subdomain or @ for root
   - **Content**: IP address, hostname, or text value
   - **TTL**: Time to live (1 = automatic, or 60-86400 seconds)
5. Configure optional settings:
   - **Proxy status**: Enable/disable Cloudflare proxy
   - **Comment/Tag**: Organizational notes
6. Click **Save**

### API Method

Create records programmatically using POST requests:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
     -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "A",
       "name": "subdomain",
       "content": "192.0.2.1",
       "ttl": 3600,
       "proxied": true,
       "comment": "Production server"
     }'
```

### Important Considerations

**Domain Setup**: If your domain uses a hosting partner integration, manage DNS records through that provider instead.

**Record Type Constraints**:
- A/AAAA cannot coexist with CNAME on same name
- NS records cannot share names with other types
- MX records require proper priority values

**TTL Settings**:
- `1` = Automatic (Cloudflare decides)
- `60-86400` = Manual TTL in seconds
- Enterprise zones: Minimum TTL of 30 seconds
- Lower TTL = faster updates, higher query volume

## Plan Availability

DNS services are **available on all plans** with varying feature sets:

### Free Plan
- Unlimited DNS queries
- Basic DNS management
- DNSSEC support
- DDoS protection
- Standard CNAME flattening

### Pro Plan ($20/month)
- All Free features
- Faster DNS resolution
- Enhanced analytics

### Business Plan ($200/month)
- All Pro features
- Priority support
- Custom CNAME flattening

### Enterprise Plan (Custom pricing)
- All Business features
- Internal DNS for private networks
- Custom solutions
- Dedicated support
- Higher rate limits

## Integration Ecosystem

### Cloudflare Registrar

Domain registration and renewal services facilitate DNS setup:
- Direct integration with DNS management
- No markup on domain prices
- Automatic DNS configuration
- Free WHOIS privacy

### DNS Resolver (1.1.1.1)

Consumer-focused DNS resolver emphasizing privacy:
- Not required for Cloudflare DNS service
- Optional for improved privacy
- Separate product from authoritative DNS

### CDN Integration

Seamless integration with Cloudflare's CDN:
- Automatic SSL/TLS provisioning
- Edge caching for proxied records
- Load balancing capabilities
- Geographic DNS routing

## Advanced Features

### Secondary DNS

Support for zone transfers:
- Incoming zone transfers (AXFR)
- Outgoing zone transfers
- Multi-primary setups
- Redundancy options

### Internal DNS (Enterprise)

Private DNS resolution for internal networks:
- Custom DNS views
- Private IP resolution
- Split-horizon DNS
- Network-specific responses

### DNS Analytics

Comprehensive query analytics:
- Query volume tracking
- Response time metrics
- Geographic distribution
- DNSSEC validation stats

## Best Practices

1. **Enable DNSSEC**: Protect against DNS attacks
2. **Use Automatic TTL**: Let Cloudflare optimize
3. **Proxy HTTP Traffic**: Enable protection features
4. **Tag Records**: Organize with comments
5. **Test Changes**: Verify DNS propagation
6. **Monitor Analytics**: Track DNS performance
7. **Backup Configuration**: Export BIND files regularly
8. **Use API for Automation**: Programmatic management for scale
