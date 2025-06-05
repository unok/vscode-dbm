# Dev Container for VSCode DB DataGrid Extension
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye

# Install additional packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        git \
        curl \
        wget \
        unzip \
        sqlite3 \
        default-mysql-client \
        postgresql-client \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install global npm packages
RUN npm install -g \
    @vscode/vsce \
    @biomejs/biome \
    typescript \
    ts-node

# Set up workspace
WORKDIR /workspace

# Expose ports for development servers and databases
EXPOSE 3000 5173 3306 5432

# Set default shell
SHELL ["/bin/bash", "-c"]