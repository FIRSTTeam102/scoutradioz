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

# Run dev script (in devcontainer mode)
yarn devcontainer