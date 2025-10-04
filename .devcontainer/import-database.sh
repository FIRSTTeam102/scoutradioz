#!/bin/bash

# Import database
echo "Unzipping database export..."
mkdir -p /tmp/db-export
unzip .devcontainer/db_export.zip -d /tmp/db-export/

echo "Dropping existing database..."
mongosh app --eval "db.dropDatabase();"

echo "Restoring database export..."
mongorestore /tmp/db-export --db app

rm -r /tmp/db-export