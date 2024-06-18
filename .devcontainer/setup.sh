#!/bin/bash

# Import database if it doesn't already exist
if [[ $(mongosh --eval "db.getMongo().getDBNames().indexOf('app')" --quiet) -lt 0 ]]; then
	bash .devcontainer/import-database.sh
else
	echo "MongoDB 'app' database already exists, not restoring"
fi

# Copy sample databases.json file if it doesn't already exist
dbsfiles=(primary/databases.json upload/databases.json voyager/src/databases.json)
for dbsfile in "${dbsfiles[@]}"; do
	if [ ! -f $dbsfile ]; then
		touch $dbsfile
		printf "{
\t\"dev\": {
\t\t\"url\": \"mongodb://127.0.0.1:27017/app\"
\t},
\t\"default\": {
\t\t\"url\": \"mongodb://127.0.0.1:27017/app\"
\t}
}" >> $dbsfile
fi
done

# Install node modules
yarn setup

# Detect the operating system version and set the NODE_VARIANT accordingly
OS_VERSION=$(lsb_release -cs)

if [ "$OS_VERSION" = "bullseye" ]; then
  export NODE_VARIANT="18-bullseye"
elif [ "$OS_VERSION" = "buster" ]; then
  export NODE_VARIANT="18-buster"
else
  echo "Unsupported OS version: $OS_VERSION"
  exit 1
fi

# Run docker-compose with the appropriate NODE_VARIANT
docker-compose up --build