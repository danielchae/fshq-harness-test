#!/bin/bash
set -euo pipefail

echo "🔧 Ensuring PostgreSQL service is installed and running..."

# Try to start service
sudo service postgresql start 2>/dev/null || true

# Initialize DB if needed
if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "Initializing PostgreSQL cluster..."
  sudo pg_ctlcluster --force 15 main start 2>/dev/null || true
fi

# Create database and user if not exist
DB_NAME="database"
DB_USER="postgres"
DB_PASS="password"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres createdb "$DB_NAME"

echo "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" | sudo -u postgres psql >/dev/null 2>&1 || true

echo "Waiting for PostgreSQL to accept connections at localhost:5432..."
for i in {1..30}; do
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
    exit 0
  fi
  sleep 1
done

echo "❌ PostgreSQL did not become ready in time"
exit 1


