param(
    [Parameter(Mandatory=$true)][string]$Email,
    [Parameter(Mandatory=$true)][string]$BaseURL,
    [string]$DataDirectory='C:/ProgramData/HadesServer/data'
)
$ErrorActionPreference='Stop'
$uri=[Uri]$BaseURL
if($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') { throw 'Use a public HTTPS root address.' }
if($Email -notmatch '^[0-9]+@qq\.com$') { throw 'This setup form is for QQ Mail.' }
$dataPath=[IO.Path]::GetFullPath($DataDirectory)
if([IO.Path]::GetPathRoot($dataPath) -eq $dataPath) { throw 'A dedicated data subdirectory is required.' }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object Windows.Forms.Form
$form.Text='Hades - QQ Mail setup'
$form.ClientSize=New-Object Drawing.Size(540,285)
$form.StartPosition='CenterScreen'
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$form.MinimizeBox=$false
$form.TopMost=$true
$label=New-Object Windows.Forms.Label
$label.Location=New-Object Drawing.Point(22,20)
$label.Size=New-Object Drawing.Size(496,68)
$label.Text="Sender: $Email`r`nServer: $($uri.Authority)`r`nEnter the QQ SMTP authorization code (not your QQ password):"
$entry=New-Object Windows.Forms.TextBox
$entry.Location=New-Object Drawing.Point(22,97)
$entry.Size=New-Object Drawing.Size(496,28)
$entry.UseSystemPasswordChar=$true
$entry.MaxLength=128
$note=New-Object Windows.Forms.Label
$note.Location=New-Object Drawing.Point(22,143)
$note.Size=New-Object Drawing.Size(496,54)
$note.Text='Saved only in the protected server data directory. No email is sent by this form. Never paste this code into a chat or source file.'
$save=New-Object Windows.Forms.Button
$save.Text='Save on server'
$save.Location=New-Object Drawing.Point(282,219)
$save.Size=New-Object Drawing.Size(138,36)
$cancel=New-Object Windows.Forms.Button
$cancel.Text='Cancel'
$cancel.Location=New-Object Drawing.Point(429,219)
$cancel.Size=New-Object Drawing.Size(89,36)
$cancel.Add_Click({$form.Close()})
$save.Add_Click({
    try {
        $authorization=$entry.Text.Trim()
        if($authorization.Length -lt 8 -or $authorization -match '\s') { throw 'Enter the complete SMTP authorization code.' }
        if(Test-Path -LiteralPath $dataPath) {
            $item=Get-Item -LiteralPath $dataPath
            if(-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Data directory must be a regular directory.' }
        } else { New-Item -ItemType Directory -Path $dataPath | Out-Null }
        $acl=New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true,$false)
        $sids=@('S-1-5-18','S-1-5-32-544',[Security.Principal.WindowsIdentity]::GetCurrent().User.Value) | Select-Object -Unique
        foreach($value in $sids) {
            $sid=New-Object Security.Principal.SecurityIdentifier($value)
            $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
            $acl.AddAccessRule($rule)
        }
        Set-Acl -LiteralPath $dataPath -AclObject $acl
        $configFile=Join-Path $dataPath 'config.json'
        if(Test-Path -LiteralPath $configFile) {
            if((Get-Item -LiteralPath $configFile).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Config must be a regular file.' }
            # File.Replace preserves the destination ACL. Remove old explicit grants before backup/replacement.
            $fileAcl=New-Object Security.AccessControl.FileSecurity
            $fileAcl.SetAccessRuleProtection($true,$false)
            foreach($value in $sids) {
                $sid=New-Object Security.Principal.SecurityIdentifier($value)
                $fileAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')))
            }
            Set-Acl -LiteralPath $configFile -AclObject $fileAcl
            $config=Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
            if(-not $config.secret -or $config.secret.Length -lt 32) { throw 'Existing server secret is invalid. Keep the file and ask for repair.' }
        } else {
            $bytes=New-Object byte[] 48
            $random=[Security.Cryptography.RandomNumberGenerator]::Create()
            try { $random.GetBytes($bytes) } finally { $random.Dispose() }
            $config=[pscustomobject]@{baseURL='';port=4318;secret=[Convert]::ToBase64String($bytes);smtp=$null}
        }
        $config.baseURL=$uri.GetLeftPart([UriPartial]::Authority)
        $config.smtp=[pscustomobject]@{host='smtp.qq.com';port=465;user=$Email;password=$authorization;from="Hades <$Email>"}
        $temporary=Join-Path $dataPath ('config-'+[Guid]::NewGuid().ToString('N')+'.tmp')
        [IO.File]::WriteAllText($temporary,($config | ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false)))
        if(Test-Path -LiteralPath $configFile) {
            $backup=Join-Path $dataPath ('config-before-'+[Guid]::NewGuid().ToString('N')+'.json')
            [IO.File]::Replace($temporary,$configFile,$backup)
        } else { [IO.File]::Move($temporary,$configFile) }
        $entry.Clear()
        $authorization=$null
        [Windows.Forms.MessageBox]::Show('Saved. The server is not enabled until HTTPS and delivery checks pass.','Hades') | Out-Null
        $form.Close()
    } catch {
        [Windows.Forms.MessageBox]::Show('Could not save. Check the authorization code and dedicated data directory. No secret values are logged.','Hades') | Out-Null
    }
})
$form.Controls.AddRange(@($label,$entry,$note,$save,$cancel))
$form.AcceptButton=$save
$form.CancelButton=$cancel
try { [void]$form.ShowDialog() } finally { $entry.Clear(); $form.Dispose() }
