const semver = require('semver');
const required = '20';
const node = process.versions.node;

if (!semver.satisfies(node, `^${required}`)) {
  console.error(`\nERROR: This project requires Node ${required}.x (found ${node}).`);
  console.error('Please install Node 20 and activate it (eg. using nvm-windows).');
  console.error('See: https://github.com/coreybutler/nvm-windows/releases');
  process.exit(1);
}
process.exit(0);
