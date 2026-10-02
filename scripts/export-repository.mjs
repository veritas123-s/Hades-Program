// Curated source export. No credentials, runtime profiles, live diagnostics or installers.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const target=path.resolve(process.argv[2]||'');
assert.ok(process.argv[2] && target!==root,'Provide a separate Git checkout');
assert.equal(execFileSync('git',['remote','get-url','origin'],{cwd:target,encoding:'utf8'}).trim(),'https://github.com/veritas123-s/Medstack-Program.git');
const roots=['src','electron','tests','assets'];
const files=['package.json','package-lock.json','index.html','vite.config.js','.gitignore',
 'docs/ORIGIN.md','docs/TENCENT-CLI-LICENSE.txt','docs/ARCHITECTURE.md','docs/WIDGET-GUIDE.md','docs/安装后使用说明.txt',
 'integration/classmate/index.py','integration/cloud/veritas_bridge.py','integration/cloud/veritas_sync.py',
 ...['prepare-cloud','scaffold-widget','desktop-test','platform-test','assistant-test','assistant-connection-test','cloud-setup-test','v2-test','v2.1-test','v2.2-test','v2.3-test','package-smoke','export-repository'].map(x=>`scripts/${x}.mjs`)];
function walk(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const file=relative+'/'+entry.name;assert.ok(!entry.isSymbolicLink(),'Symlink not allowed');if(entry.isDirectory())walk(file);else files.push(file);}}
roots.forEach(walk);
const bodies=new Map();
for(const file of files){
 assert.ok(!/(^|\/)(backups|test-results|node_modules|\.env)|\.(bin|bak|pyc)$/.test(file),'Private file path');
 const body=fs.readFileSync(path.join(root,file));
 if(/\.(mjs|cjs|js|jsx|json|css|html|md|txt|py|svg)$/.test(file)){
  assert.ok(!/\bsk-[A-Za-z0-9_-]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|\bAKID[A-Za-z0-9]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|C:[\\/]+Users[\\/]+(?!User[\\/])[^%/\\\s]+/i.test(body.toString('utf8')),'Sensitive content in '+file);
 }
 bodies.set(file,body);
}
// Existing unrelated repository files are preserved. No recursive deletion or force push.
for(const [file,body] of bodies){const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);}
console.log(JSON.stringify({exported:files.length,version:JSON.parse(bodies.get('package.json')).version}));
