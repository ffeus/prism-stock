import path from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {inventoryBridge} from './server/inventory-bridge.mjs';

// Opt-in local live UI. Production Tauri and offline preview retain separate transports.
export default defineConfig({
 cacheDir:'node_modules/.vite-inventory',
 plugins:[react(),tailwindcss(),inventoryBridge({dataDir:process.env.PRISM_INVENTORY_DATA_DIR,port:Number(process.env.PRISM_INVENTORY_PORT??1425)})],
 define:{'import.meta.env.VITE_PRISM_RUNTIME':JSON.stringify('inventory')},
 resolve:{alias:[
  {find:'@tauri-apps/api/core',replacement:path.resolve(__dirname,'src/services/browserTransport.ts')},
  {find:'@tauri-apps/api/event',replacement:path.resolve(__dirname,'src/services/browserTransport.ts')},
  {find:'@tauri-apps/plugin-opener',replacement:path.resolve(__dirname,'src/services/browserTransport.ts')},
  {find:'@',replacement:path.resolve(__dirname,'src')},
 ]},
 server:{host:'127.0.0.1',port:Number(process.env.PRISM_INVENTORY_PORT??1425),strictPort:true,allowedHosts:['127.0.0.1','localhost'],headers:{'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'none'"},watch:{ignored:['**/src-tauri/**','**/crates/**','**/target/**']}},
});
