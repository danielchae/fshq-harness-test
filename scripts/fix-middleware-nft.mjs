import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const isPre = process.argv[2] === 'pre';
const serverDir = join(process.cwd(), '.next', 'server');
const nftPath = join(serverDir, 'middleware.js.nft.json');

if (isPre) {
  // Pre-build: create the .next/server directory and empty nft.json
  // so Next.js build doesn't fail when trying to read it
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(nftPath, JSON.stringify({ version: 1, files: [] }));
  console.log('[fix-middleware-nft] Pre-build: created empty middleware.js.nft.json');
} else {
  // Post-build: ensure the file exists (in case build deleted it)
  if (!existsSync(nftPath)) {
    mkdirSync(serverDir, { recursive: true });
    writeFileSync(nftPath, JSON.stringify({ version: 1, files: [] }));
    console.log('[fix-middleware-nft] Post-build: created missing middleware.js.nft.json');
  } else {
    console.log('[fix-middleware-nft] Post-build: middleware.js.nft.json exists');
  }
}
