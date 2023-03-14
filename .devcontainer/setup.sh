#!/bin/bash

# Import database if it doesn't already exist
if [[ -d "/workspaces/scoutradioz-dbdump" && $(mongosh --eval "db.getMongo().getDBNames().indexOf('app')" --quiet) -lt 0 ]]; then
	mongorestore "/workspaces/scoutradioz-dbdump" --db app
else
	echo "MongoDB 'app' database already exists, not restoring"
fi

# Copy sample databases.json file if it doesn't already exist
dbsfile=primary/databases.json
if [ ! -f $dbsfile ]; then
	touch $dbsfile
	printf "{
\t\"dev\": {
\t\t\"url\": \"mongodb://localhost:27017/app\"
\t},
\t\"default\": {
\t\t\"url\": \"mongodb://localhost:27017/app\"
\t}
}" >> $dbsfile
fi

# Install node modules
yarn run setup