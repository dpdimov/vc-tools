#!/usr/bin/env node
const { execSync } = require('child_process');

const ROOT = __dirname;

console.log('=================================');
console.log('VC Tools - Build Script');
console.log('=================================\n');

console.log('Building React apps...\n');
try {
  execSync('npm run build --workspaces --if-present', {
    stdio: 'inherit',
    cwd: ROOT
  });
  console.log('\nReact apps built successfully!\n');
} catch (error) {
  console.error('Error building React apps:', error.message);
  process.exit(1);
}

console.log('=================================');
console.log('Build complete!');
console.log('=================================\n');

console.log('Output directories:');
console.log('  React apps -> /{app-name}/');
console.log('\nTo preview locally: npx serve .');
