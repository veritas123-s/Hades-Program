import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { validateRelease, newerVersion } from "../src/releases.mjs";
import { publicResponse, abortable } from "./public-fetch.mjs";

const assetHosts = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);
export function installerURL(raw) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    !assetHosts.has(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw Error("安装包跳转目标不受信任");
  return u.href;
}
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
export function updateWorker({
  pid,
  executable,
  installer,
  sha256,
  directory,
  backup,
  version,
}) {
  if (
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !/^\d+\.\d+\.\d+$/.test(version)
  )
    throw Error("更新参数无效");
  const destination = path.dirname(executable);
  if (
    ![executable, installer, directory, backup].every((p) =>
      path.isAbsolute(p),
    ) ||
    path.basename(executable).toLowerCase() !== "medstack.exe"
  )
    throw Error("安装路径无效");
  return `$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
$installer=${quote(installer)}
$destination=${quote(destination)}
$exe=${quote(executable)}
$profile=${quote(directory)}
$backup=${quote(backup)}
$receipt=Join-Path $profile 'medstack-update-result.json'
$oldProgram=Join-Path $backup 'previous-program'
$installed=$false
$backupVerified=$false
$installerStarted=$false
try {
  for($i=0;$i -lt 120;$i++){if(-not(Get-Process -Id ${pid} -ErrorAction SilentlyContinue)){break};Start-Sleep -Seconds 1}
  if(Get-Process -Id ${pid} -ErrorAction SilentlyContinue){throw 'Application did not exit'}
  Start-Sleep -Seconds 2
  if((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLower() -ne '${sha256}'){throw 'Installer hash mismatch'}
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $skip=@('upgrade-backups','updates','Cache','Code Cache','GPUCache','GPUPersistentCache','GrShaderCache','ShaderCache','DawnGraphiteCache','DawnWebGPUCache')
  $manifest=@()
  function Copy-Checked($source,$target){
    $entry=Get-Item -LiteralPath $source
    if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Profile links are not supported'}
    if($entry.PSIsContainer){New-Item -ItemType Directory -Path $target -Force|Out-Null; foreach($item in Get-ChildItem -LiteralPath $source -Force){Copy-Checked $item.FullName (Join-Path $target $item.Name)}}
    else{Copy-Item -LiteralPath $source -Destination $target -Force; if((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $target).Hash){throw 'Backup verification failed'}}
  }
  foreach($item in Get-ChildItem -LiteralPath $profile -Force){if($skip -notcontains $item.Name){Copy-Checked $item.FullName (Join-Path $backup $item.Name)}}
  foreach($file in Get-ChildItem -LiteralPath $profile -Filter 'veritas-data.json' -Recurse -File | Where-Object {$_.FullName -notlike '*\\upgrade-backups\\*'}){
    $null=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    $manifest+=@{file=$file.FullName;hash=(Get-FileHash -LiteralPath $file.FullName).Hash}
  }
  Copy-Checked $destination $oldProgram
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backup 'update-manifest.json') -Encoding UTF8
  $backupVerified=$true
  $installerStarted=$true
  $installProcess=Start-Process -FilePath $installer -ArgumentList @('/S',('/D='+$destination)) -WindowStyle Hidden -Wait -PassThru
  if($installProcess.ExitCode -ne 0){throw 'Installer failed'}
  if(-not(Test-Path -LiteralPath $exe)){throw 'Installed application is missing'}
  foreach($record in $manifest){if((Get-FileHash -LiteralPath $record.file).Hash -ne $record.hash){throw 'Personal data changed during installation'}}
  $installed=$true
  @{ok=$true;version='${version}';backup=$backup} | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding UTF8
} catch {
  if($backupVerified -and $installerStarted){Get-ChildItem -LiteralPath $oldProgram -Force | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force}}
  @{ok=$false;version='${version}';backup=$backup;error='Update failed. Previous program and data backup retained.'} | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding UTF8
} finally {if(Test-Path -LiteralPath $exe){Start-Process -FilePath $exe -WorkingDirectory $destination}}
`;
}
export class UpdateInstaller {
  constructor({
    directory,
    version,
    executable,
    packaged,
    changed = () => {},
    fetcher = fetch,
    exit,
    launch = spawn,
  }) {
    Object.assign(this, {
      directory,
      version,
      executable,
      packaged,
      changed,
      fetcher,
      exit,
      launch,
    });
    this.state = {
      phase: "idle",
      received: 0,
      total: 0,
      error: "",
      supported: process.platform === "win32" && packaged,
    };
  }
  status() {
    return { ...this.state };
  }
  set(patch) {
    Object.assign(this.state, patch);
    this.changed();
  }
  async install(input) {
    if (!this.state.supported) throw Error("一键更新仅支持已安装的 Windows 版");
    if (["downloading", "verifying", "installing"].includes(this.state.phase))
      throw Error("正在更新，请等待");
    const release = validateRelease(input);
    if (!newerVersion(release.version, this.version))
      throw Error("当前已是最新版本");
    const asset = release.downloads.windows;
    if (!asset) throw Error("Windows 安装包尚未发布");
    const destination = path.join(this.directory, "updates", release.version);
    fs.mkdirSync(destination, { recursive: true });
    const installer = path.join(
        destination,
        `Medstack-Setup-${release.version}-x64.exe`,
      ),
      pending = installer + ".pending";
    this.set({ phase: "downloading", received: 0, total: 0, error: "" });
    let file, reader;
    try {
      const signal = AbortSignal.timeout(300000);
      const response = await publicResponse(asset.url, {
        validate: installerURL,
        fetcher: this.fetcher,
        signal,
        headers: { Accept: "application/octet-stream" },
      });
      if (!response.ok || !response.body) throw Error("新版下载失败");
      const total = Number(response.headers.get("content-length")) || 0,
        max = 300 * 1024 * 1024;
      if (total > max) throw Error("安装包超过大小限制");
      this.set({ total });
      file = fs.openSync(pending, "w", 0o600);
      const hash = createHash("sha256");
      reader = response.body.getReader();
      let received = 0,
        lastNotice = 0;
      for (;;) {
        const { done, value } = await abortable(reader.read(), signal);
        signal.throwIfAborted();
        if (done) break;
        received += value.length;
        if (received > max) {
          await reader.cancel();
          throw Error("安装包超过大小限制");
        }
        hash.update(value);
        fs.writeSync(file, value);
        if (Date.now() - lastNotice > 200) {
          this.set({ received });
          lastNotice = Date.now();
        }
      }
      fs.fsyncSync(file);
      fs.closeSync(file);
      file = undefined;
      this.set({ phase: "verifying", received });
      if (received < 100000 || hash.digest("hex") !== asset.sha256)
        throw Error("安装包校验失败，未安装");
      fs.renameSync(pending, installer);
      const backup = path.join(
        this.directory,
        "upgrade-backups",
        `auto-v${release.version}-${Date.now()}`,
      );
      const worker = path.join(destination, "install-update.ps1");
      fs.writeFileSync(
        worker,
        "\ufeff" +
          updateWorker({
            pid: process.pid,
            executable: this.executable,
            installer,
            sha256: asset.sha256,
            directory: this.directory,
            backup,
            version: release.version,
          }),
        { mode: 0o600 },
      );
      // Pause/persist before launching the worker; failure leaves the app running.
      await this.exit(async () => {
        const shell = path.join(
          process.env.WINDIR || "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        );
        const child = this.launch(
          shell,
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            worker,
          ],
          { detached: true, windowsHide: true, stdio: "ignore" },
        );
        await new Promise((resolve, reject) => {
          child.once("spawn", resolve);
          child.once("error", reject);
        });
        child.unref();
        this.set({ phase: "installing" });
      });
      return this.status();
    } catch (error) {
      this.set({
        phase: "error",
        error: /校验|大小|安装|下载/.test(error.message)
          ? error.message
          : "更新未完成，请重试或手动下载安装包",
      });
      throw Error(this.state.error);
    } finally {
      if (file !== undefined) fs.closeSync(file);
      reader?.releaseLock();
      if (fs.existsSync(pending)) fs.unlinkSync(pending);
    }
  }
}
