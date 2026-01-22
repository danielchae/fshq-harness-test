# Cloudflare DNS API Reference

**Source**: https://developers.cloudflare.com/api/resources/dns/

## Core Endpoints

The Cloudflare DNS API provides comprehensive management of DNS records through RESTful endpoints.

### Record Management Endpoints

**List DNS Records**
```
GET /zones/{zone_id}/dns_records
```
List, search, sort, and filter a zone's DNS records.

**Get DNS Record**
```
GET /zones/{zone_id}/dns_records/{dns_record_id}
```
Retrieve specific record details.

**Create DNS Record**
```
POST /zones/{zone_id}/dns_records
```
Create new DNS records for a zone.

**Update DNS Record (Full)**
```
PUT /zones/{zone_id}/dns_records/{dns_record_id}
```
Overwrite existing records completely.

**Update DNS Record (Partial)**
```
PATCH /zones/{zone_id}/dns_records/{dns_record_id}
```
Partial updates to existing records.

**Delete DNS Record**
```
DELETE /zones/{zone_id}/dns_records/{dns_record_id}
```
Remove DNS records from the zone.

## Supported Record Types

The API supports 21+ DNS record types including:
- **A, AAAA** - IPv4 and IPv6 address records
- **CNAME** - Canonical name records
- **MX** - Mail exchange records
- **NS** - Name server records
- **TXT** - Text records
- **CAA** - Certification Authority Authorization
- **CERT** - Certificate records
- **DNSKEY** - DNS public keys
- **DS** - Delegation signer
- **HTTPS** - HTTPS service binding
- **LOC** - Location information
- **NAPTR** - Naming Authority Pointer
- **PTR** - Pointer records
- **SRV** - Service locator
- **SSHFP** - SSH public key fingerprint
- **SVCB** - Service binding
- **TLSA** - TLS authentication
- **URI** - Uniform Resource Identifier

## Important Constraints

Creation and modification operations must follow these rules:

1. **A/AAAA + CNAME Conflict**: A or AAAA records cannot coexist with CNAME records on the same domain name
2. **NS Record Exclusivity**: NS records cannot share names with other record types
3. **Punycode Encoding**: Domain names are always represented in Punycode, even if Unicode characters were used in the request

## Batch Processing

**Batch Operations**
```
POST /zones/{zone_id}/dns_records/batch
```
Execute multiple operations in sequence (deletes, patches, puts, posts) in a single API call.

## Import/Export Operations

**Export BIND Configuration**
```
GET /zones/{zone_id}/dns_records/export
```
Export zone DNS records in BIND format.

**Import BIND Configuration**
```
POST /zones/{zone_id}/dns_records/import
```
Upload and import BIND configuration file.

## DNS Scanning

**Trigger DNS Scan**
```
POST /zones/{zone_id}/dns_records/scan/trigger
```
Initiate asynchronous DNS record discovery for common records.

**Review Scan Results**
```
POST /zones/{zone_id}/dns_records/scan/review
```
Accept or reject discovered DNS records from scanning.

## Authentication

API requires token-based authentication with specific permission groups:
- **DNS Read** - For query operations (GET requests)
- **DNS Write** - For modification operations (POST, PUT, PATCH, DELETE)

Authentication methods supported:
- `api_token` (recommended)
- `api_email` + `api_key` combination (legacy)

## Additional Features

### DNSSEC Management
- View DNSSEC configuration
- Enable/disable DNSSEC for zones
- Delete DNSSEC configuration

### DNS Settings
- Account-level configuration options
- Zone-level DNS settings
- Internal DNS Views for custom resolution

### Zone Transfers
- Secondary DNS support (incoming/outgoing)
- AXFR (full zone transfer) triggering
- Zone transfer management

## Example Request

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
     -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "A",
       "name": "example.com",
       "content": "198.51.100.4",
       "ttl": 3600,
       "proxied": false
     }'
```

## Response Format

All API responses follow a consistent structure:
```json
{
  "success": true,
  "errors": [],
  "messages": [],
  "result": {
    "id": "record_id",
    "type": "A",
    "name": "example.com",
    "content": "198.51.100.4",
    "ttl": 3600,
    "proxied": false,
    "created_on": "2025-01-01T00:00:00Z",
    "modified_on": "2025-01-01T00:00:00Z"
  }
}
```
