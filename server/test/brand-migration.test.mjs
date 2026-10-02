import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {databaseFile,migrateSnapshotTables} from '../storage.mjs';
test('数据库更名迁移保留账号、原始同步文档和删除记录，只执行一次',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'medstack-db-migrate-'));const old=path.join(root,Buffer.from('aGFkZXMuc3FsaXRl','base64').toString());
 const names=['aGFkZXNfc25hcHNob3Rz','aGFkZXNfaGlzdG9yeQ=='].map(s=>Buffer.from(s,'base64').toString());
 let db=new DatabaseSync(old);
 try {
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE user(id TEXT PRIMARY KEY,email TEXT); INSERT INTO user VALUES('synthetic','test@synthetic.invalid'); CREATE TABLE ${names[0]}(uid TEXT PRIMARY KEY,version INTEGER,document TEXT,updated_at INTEGER); CREATE TABLE ${names[1]}(uid TEXT,version INTEGER,document TEXT,created_at INTEGER,PRIMARY KEY(uid,version));`);
  const data=JSON.stringify({tasks:[{id:'test',deletedAt:42}],logs:[{durationMs:1234}]});db.prepare(`INSERT INTO ${names[0]} VALUES(?,?,?,?)`).run('synthetic',7,data,1);db.prepare(`INSERT INTO ${names[1]} VALUES(?,?,?,?)`).run('synthetic',7,data,1);db.close();
  const next=await databaseFile(root);assert.equal(path.basename(next),'medstack.sqlite');assert.ok(fs.existsSync(old));db=new DatabaseSync(next);
  db.exec('CREATE TABLE medstack_snapshots(uid TEXT PRIMARY KEY,version INTEGER,document TEXT,updated_at INTEGER); CREATE TABLE medstack_history(uid TEXT,version INTEGER,document TEXT,created_at INTEGER,PRIMARY KEY(uid,version));');migrateSnapshotTables(db);
  assert.equal(db.prepare('SELECT document FROM medstack_snapshots').get().document,data);assert.equal(db.prepare('SELECT email FROM user').get().email,'test@synthetic.invalid');
  db.exec('DELETE FROM medstack_snapshots');migrateSnapshotTables(db);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM medstack_snapshots').get().n,0);
 }finally{try{db.close();}catch{} fs.rmSync(root,{recursive:true,force:true});}
});
