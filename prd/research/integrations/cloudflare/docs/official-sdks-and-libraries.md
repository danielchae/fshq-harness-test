# Cloudflare Official SDKs and Libraries

**Source**: https://github.com/cloudflare

Cloudflare maintains several official API client libraries across different programming languages, all generated from their OpenAPI specification.

## Official SDK Repositories

### TypeScript/Node.js
**Repository**: [cloudflare/cloudflare-typescript](https://github.com/cloudflare/cloudflare-typescript)

The official TypeScript library replacing the legacy `cloudflare/node-cloudflare` repository.

**Installation:**
```bash
npm install cloudflare
# or
yarn add cloudflare
# or
pnpm add cloudflare
```

**Features:**
- Full TypeScript type definitions
- Synchronous and asynchronous clients
- Auto-pagination for list methods
- Promise-based API
- Works in Node.js and browser environments

**Example Usage:**
```typescript
import Cloudflare from 'cloudflare';

const client = new Cloudflare({
  apiToken: 'YOUR_API_TOKEN',
});

// List DNS records
const records = await client.dns.records.list({
  zone_id: 'YOUR_ZONE_ID',
});

// Create DNS record
const record = await client.dns.records.create({
  zone_id: 'YOUR_ZONE_ID',
  type: 'A',
  name: 'example.com',
  content: '192.0.2.1',
  ttl: 3600,
  proxied: true,
});
```

### Python
**Repository**: [cloudflare/cloudflare-python](https://github.com/cloudflare/cloudflare-python)

The official Python library provides convenient access to the Cloudflare REST API from any Python 3.8+ application.

**Installation:**
```bash
pip install cloudflare
```

**Features:**
- Type hints for all parameters and responses
- Synchronous and asynchronous clients
- Auto-pagination support
- Pydantic models for validation
- Exception handling

**Example Usage:**
```python
from cloudflare import Cloudflare

client = Cloudflare(api_token="YOUR_API_TOKEN")

# List DNS records
records = client.dns.records.list(zone_id="YOUR_ZONE_ID")

# Create DNS record
record = client.dns.records.create(
    zone_id="YOUR_ZONE_ID",
    type="A",
    name="example.com",
    content="192.0.2.1",
    ttl=3600,
    proxied=True
)

# Async usage
import asyncio
from cloudflare import AsyncCloudflare

async def main():
    client = AsyncCloudflare(api_token="YOUR_API_TOKEN")
    records = await client.dns.records.list(zone_id="YOUR_ZONE_ID")

asyncio.run(main())
```

### Go
**Repository**: [cloudflare/cloudflare-go](https://github.com/cloudflare/cloudflare-go)

The official Go library provides convenient access to the Cloudflare REST API from applications written in Go.

**Installation:**
```bash
go get github.com/cloudflare/cloudflare-go/v2
```

**Features:**
- Full Go type definitions
- Context support
- Auto-pagination
- Generated with Stainless
- Idiomatic Go patterns

**Example Usage:**
```go
package main

import (
    "context"
    "fmt"
    "github.com/cloudflare/cloudflare-go/v2"
)

func main() {
    client := cloudflare.NewClient(
        cloudflare.WithAPIToken("YOUR_API_TOKEN"),
    )

    ctx := context.Background()

    // List DNS records
    records, err := client.DNS.Records.List(ctx, cloudflare.DNSRecordListParams{
        ZoneID: cloudflare.String("YOUR_ZONE_ID"),
    })

    // Create DNS record
    record, err := client.DNS.Records.Create(ctx, cloudflare.DNSRecordCreateParams{
        ZoneID:  cloudflare.String("YOUR_ZONE_ID"),
        Type:    cloudflare.String("A"),
        Name:    cloudflare.String("example.com"),
        Content: cloudflare.String("192.0.2.1"),
        TTL:     cloudflare.Int64(3600),
        Proxied: cloudflare.Bool(true),
    })
}
```

### PHP
**Repository**: [cloudflare/cloudflare-php](https://github.com/cloudflare/cloudflare-php)

PHP library for the Cloudflare v4 API.

**Installation:**
```bash
composer require cloudflare/sdk
```

**Features:**
- PSR-7/PSR-18 HTTP client support
- PHP 8.0+ compatible
- Comprehensive API coverage
- Exception-based error handling

**Example Usage:**
```php
<?php

use Cloudflare\Client;

$client = new Client([
    'api_token' => 'YOUR_API_TOKEN',
]);

// List DNS records
$records = $client->dns->records->list([
    'zone_id' => 'YOUR_ZONE_ID',
]);

// Create DNS record
$record = $client->dns->records->create([
    'zone_id' => 'YOUR_ZONE_ID',
    'type' => 'A',
    'name' => 'example.com',
    'content' => '192.0.2.1',
    'ttl' => 3600,
    'proxied' => true,
]);
```

## Common SDK Features

All official Cloudflare SDKs share these characteristics:

### 1. Type Safety
- Full type definitions for all request params
- Type definitions for all response fields
- Compile-time/IDE autocomplete support

### 2. Auto-Pagination
List methods in the Cloudflare API are paginated. SDKs provide automatic pagination:

```typescript
// TypeScript example
for await (const record of client.dns.records.list({ zone_id })) {
  console.log(record);
}
```

### 3. Dual Clients
Both synchronous and asynchronous clients available in most languages:
- Synchronous: Blocking operations
- Asynchronous: Non-blocking, concurrent operations

### 4. Generated from OpenAPI
All SDKs are generated from Cloudflare's OpenAPI specification:
- Consistent API across languages
- Automatic updates with API changes
- High accuracy and completeness

### 5. Error Handling
Structured error responses:
```typescript
try {
  await client.dns.records.create({ ... });
} catch (error) {
  if (error instanceof Cloudflare.APIError) {
    console.log(error.status); // 400
    console.log(error.message); // Error message
    console.log(error.code); // Error code
  }
}
```

## Community Libraries

In addition to official SDKs, there are community-maintained libraries:

### Java
**Repository**: [robinbraemer/CloudflareAPI](https://github.com/robinbraemer/CloudflareAPI)
- Most complete and extensible Cloudflare API v4 client for Java

### Lightweight JavaScript
**Repository**: [kriasoft/cloudflare-client](https://github.com/kriasoft/cloudflare-client)
- Universal Cloudflare API client for Node.js, Browser, and Cloudflare Workers
- Minimal dependencies

## GitHub Organization

**Main Organization**: [github.com/cloudflare](https://github.com/cloudflare)
- 527+ public repositories
- Official SDKs and tools
- Open-source projects
- Documentation examples

## Choosing an SDK

**For FSHQ.gg Project:**
- **TypeScript/Node.js**: Best choice if backend is Node.js/TypeScript
- **Python**: Ideal for Python-based backends or automation scripts
- **Go**: Excellent for high-performance microservices
- **PHP**: Suitable if using PHP backend

## Documentation Links

Each SDK repository includes:
- README with quickstart guide
- API reference documentation
- Example usage patterns
- Migration guides (where applicable)
- Changelog and version history

## Support and Updates

All official SDKs are:
- Actively maintained by Cloudflare
- Regularly updated with new API features
- Support latest Cloudflare API version
- Include security updates
- Have issue tracking on GitHub
