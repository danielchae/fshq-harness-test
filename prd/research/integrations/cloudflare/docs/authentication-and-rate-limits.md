# Cloudflare API Authentication & Rate Limits

**Sources**:
- https://developers.cloudflare.com/api/
- https://developers.cloudflare.com/fundamentals/api/reference/limits/

## Authentication Methods

Cloudflare requires authentication for all API requests. The platform supports two primary authentication approaches:

### API Tokens (Recommended)

API Tokens are the preferred method for accessing the Cloudflare API. They offer improved security and can be scoped with specific permissions.

**Creating an API Token:**
1. Navigate to Cloudflare dashboard
2. Go to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Select permissions and resources
5. Set optional restrictions (IP addresses, TTL)

**Token Features:**
- **Scoped Permissions**: Limit access to specific resources and actions
- **IP Filtering**: Restrict usage to specific client IP addresses
- **Time-To-Live (TTL)**: Set expiration times with `not_before` and `expires_on`
- **Security**: Much more secure than legacy API keys

**Usage:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
```

### API Keys (Legacy)

Global API Keys are supported but have "several limitations" that make them less secure than tokens. The documentation advises using tokens whenever feasible.

**Limitations:**
- Full account access (cannot be scoped)
- No IP restrictions available
- No expiration options
- Higher security risk

**Usage:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "X-Auth-Email: your-email@example.com" \
     -H "X-Auth-Key: YOUR_API_KEY"
```

## Rate Limits

### Global Rate Limit

**Primary Limit**: 1,200 requests per five minute period per user

This limit applies:
- **Per User**: Not per token, zone, or account
- **Across All Methods**: Dashboard, API key, and token usage combined
- **Cumulatively**: All API calls count toward the same limit

**Exceeded Limit Response:**
- Returns `HTTP 429 - Too Many Requests`
- Blocks all API calls for the subsequent five minutes

### Additional Rate Limits

**Per-IP Throttling**: 200 requests per second maximum for Client API

**GraphQL API**: Varies based on query complexity
- Maximum of 320 requests per 5-minute window

### Token Quotas

**Per Account Limits:**
- Users may create up to **50 API tokens** per account
- Accounts support **500 total tokens** across all users

## Rate Limit Response Headers

REST APIs return three informational headers to help manage rate limits:

**Ratelimit Header:**
- Shows remaining quota
- Displays window reset time

**Ratelimit-Policy Header:**
- Displays total quota
- Shows applicable time window

**retry-after Header:**
- Only present when limit exceeded
- Seconds until capacity restores

### Example Headers

```
Ratelimit: 1150
Ratelimit-Policy: 1200;w=300
retry-after: 120
```

## Specialized Rate Limits

Certain APIs enforce independent rate restrictions:
- **Cache Purge API**: Separate limits
- **GraphQL API**: Complexity-based limits
- **Rulesets API**: Independent quotas
- **Lists API**: Separate rate limits
- **Gateway Lists**: Independent restrictions

## Enterprise Options

Enterprise customers may request higher thresholds by contacting Cloudflare Support to increase:
- Client API per-user limits
- GraphQL query limits
- Token creation quotas

## Best Practices

1. **Use API Tokens**: Always prefer tokens over API keys
2. **Implement Retry Logic**: Handle 429 responses gracefully
3. **Monitor Headers**: Track rate limit headers in responses
4. **Batch Operations**: Use batch endpoints where available
5. **Cache Responses**: Reduce unnecessary API calls
6. **Scope Tokens Appropriately**: Use minimum required permissions
7. **Set Token Expiration**: Implement token rotation policies
8. **IP Restriction**: Limit tokens to known IP addresses

## Common Errors

**429 Too Many Requests**
```json
{
  "success": false,
  "errors": [
    {
      "code": 10000,
      "message": "Rate limit exceeded"
    }
  ]
}
```

**Solution**: Wait for the retry-after period or implement exponential backoff.

## Testing API Access

Verify your authentication setup:
```bash
# Test with API Token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer YOUR_API_TOKEN"

# Expected response:
{
  "success": true,
  "result": {
    "id": "token_id",
    "status": "active"
  }
}
```
