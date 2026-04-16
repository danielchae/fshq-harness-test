import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const nftPath = join(process.cwd(), '.next', 'server', 'middleware.js.nft.json');
if (!existsSync(nftPath)) {
  console.log('Creating missing middleware.js.nft.json...');
  mkdirSync(join(process.cwd(), '.next', 'server'), { recursive: true });
  writeFileSync(nftPath, JSON.stringify({ version: 1, files: [] }));
  console.log('Done.');
} else {
  console.log('middleware.js.nft.json already exists.');
}
