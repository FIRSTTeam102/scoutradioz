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

# Detect OS version
detect_os_version() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_VERSION=$VERSION_CODENAME
    else
        echo "Unsupported OS: /etc/os-release not found"
        exit 1
    fi
}

# Set NODE_VARIANT based on OS version
set_node_variant() {
    case $OS_VERSION in
        "bullseye")
            export VARIANT="18-bullseye"
            ;;
        "buster")
            export VARIANT="18-buster"
            ;;
        *)
            echo "Unsupported OS version: $OS_VERSION"
            exit 1
            ;;
    esac
}

# Install node modules
yarn setup

# Main script execution
detect_os_version
set_node_variant

# Make setup.sh executable if not already
chmod +x setup.sh

# Execute docker-compose with the appropriate VARIANT
docker-compose up --build