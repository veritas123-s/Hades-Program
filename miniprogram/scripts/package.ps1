$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactDirectory = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$names = @('app.js', 'app.json', 'app.wxss', 'config.js', 'project.config.json', 'sitemap.json', 'README.md', 'lib', 'pages', 'assets')
$sourcePaths = $names | ForEach-Object { Join-Path $projectRoot $_ }
foreach ($sourcePath in $sourcePaths) {
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing package input: $sourcePath" }
}
$packagePath = Join-Path $artifactDirectory 'Medstack-WeChat-0.1.0-preview.zip'
Compress-Archive -LiteralPath $sourcePaths -DestinationPath $packagePath -Force
$archive = [IO.Compression.ZipFile]::OpenRead($packagePath)
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($required in @('app.js', 'project.config.json', 'lib/domain.js', 'pages/settings/index.wxml')) {
        if ($entries -notcontains $required) { throw "Missing archive entry: $required" }
    }
    if ($entries | Where-Object { $_ -match '(^|/)(tests|scripts|artifacts|server|local-ops|node_modules)/|\.env|\.pem$|\.key$' }) {
        throw 'Unexpected private or development content in archive'
    }
    $fileCount = $archive.Entries.Count
} finally { $archive.Dispose() }
$hash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $artifactDirectory 'SHA256SUMS.txt'), "$hash  Medstack-WeChat-0.1.0-preview.zip`n", [Text.UTF8Encoding]::new($false))
Write-Output "Packaged and inspected $fileCount entries; SHA256 $hash"
