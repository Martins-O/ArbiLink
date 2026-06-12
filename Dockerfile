FROM node:22-alpine

# Work inside the relayer package — this ensures Node picks up
# packages/relayer/package.json ("type": "module") automatically.
WORKDIR /app/packages/relayer

# Install dependencies
COPY packages/relayer/package.json ./
RUN npm install

# Copy TypeScript source and compiler config
COPY packages/relayer/src         ./src
COPY packages/relayer/tsconfig.json ./

# Copy SDK ABI files.
# The compiled dist/index.js loads them via:
#   createRequire(import.meta.url) → "../../sdk/src/abi/..."
# which resolves to /app/packages/sdk/src/abi/ from dist/index.js.
COPY packages/sdk/src/abi /app/packages/sdk/src/abi

# Compile TypeScript → dist/
RUN npx tsc

CMD ["node", "dist/index.js"]
