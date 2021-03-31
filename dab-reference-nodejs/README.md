# DAB Reference for Node.js

The reference implementation for Node.js provides a spec compliant device side interface that is intended to be extended by the developer to meet their specific requirements along with a sample DAB device which implements this interface as well as a DAB client which can communicate with it.

## Installation
Make sure you're running node 14 and upgrade if necessary
```bash
node --version
```
NPM install the required dependencies for the app
```bash
cd dab-reference-nodejs-alpha
npm install
```

## Usage
Various DAB sample commands will be run against the stub DAB device implementation:
```bash
cd dab-reference-nodejs-alpha
npm test
# Logs will print to console indicating requests and responses received
```