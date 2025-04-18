# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
# set in docker-compose.yml
ARG VARIANT
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}

# Install MongoDB command line tools if on buster and x86_64 (arm64 not supported)
ARG MONGO_TOOLS_VERSION=5.0
RUN . /etc/os-release \
	&& if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
		curl -sSL "https://www.mongodb.org/static/pgp/server-${MONGO_TOOLS_VERSION}.asc" | gpg --dearmor > /usr/share/keyrings/mongodb-archive-keyring.gpg \
		&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg] http://repo.mongodb.org/apt/debian $(lsb_release -cs)/mongodb-org/${MONGO_TOOLS_VERSION} main" | tee /etc/apt/sources.list.d/mongodb-org-${MONGO_TOOLS_VERSION}.list \
		&& apt-get update && export DEBIAN_FRONTEND=noninteractive \
		&& apt-get install -y mongodb-database-tools mongodb-mongosh \
		&& apt-get clean -y && rm -rf /var/lib/apt/lists/*; \
	fi

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node modules
RUN su node -c "yarn global add less less-plugin-clean-css typescript ts-node"

run curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
run unzip awscliv2.zip
run sudo ./aws/install

# Download and install Bun
RUN curl -fsSL https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip -o bun.zip \
    && unzip bun.zip \
    && mv bun-linux-x64/bun /usr/local/bin/ \
    && chmod +x /usr/local/bin/bun \
    && rm -rf bun.zip bun-linux-x64