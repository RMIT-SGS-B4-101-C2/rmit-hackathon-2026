$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeVersion = (Get-Content (Join-Path $projectRoot '.node-version') -Raw).Trim()
$candidates = @(
    (Join-Path $projectRoot ".tools\node-v$nodeVersion-win-x64"),
    (Join-Path $projectRoot '.tools\bin'),
    'C:\Program Files\Git\bin',
    'C:\Program Files\Docker\Docker\resources\bin',
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin')
)
foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { $env:Path = "$candidate;$env:Path" }
}
