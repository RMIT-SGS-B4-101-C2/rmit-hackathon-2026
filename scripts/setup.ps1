param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force '.tools', '.tools/bin', '.tide-pack' | Out-Null
    $nodeVersion = (Get-Content '.node-version' -Raw).Trim()
    $nodeDirectory = ".tools/node-v$nodeVersion-win-x64"
    if (-not (Test-Path "$nodeDirectory/node.exe")) {
        $archive = "node-v$nodeVersion-win-x64.zip"
        $base = "https://nodejs.org/dist/v$nodeVersion"
        Invoke-WebRequest -UseBasicParsing "$base/$archive" -OutFile ".tools/$archive"
        Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt" -OutFile '.tools/SHASUMS256.txt'
        $line = Get-Content '.tools/SHASUMS256.txt' | Where-Object { $_ -match "  $([regex]::Escape($archive))$" }
        if (-not $line -or (Get-FileHash ".tools/$archive" -Algorithm SHA256).Hash -ne ($line -split '\s+')[0]) {
            throw 'Node download checksum mismatch'
        }
        Expand-Archive -LiteralPath ".tools/$archive" -DestinationPath '.tools' -Force
    }
    . "$PSScriptRoot/env.ps1"
    if (-not (Test-Path '.tools/bin/jq.exe')) {
        $release = Invoke-RestMethod 'https://api.github.com/repos/jqlang/jq/releases/latest'
        $asset = $release.assets | Where-Object name -eq 'jq-windows-amd64.exe' | Select-Object -First 1
        $checksums = $release.assets | Where-Object name -eq 'sha256sum.txt' | Select-Object -First 1
        if (-not $asset -or -not $checksums) { throw 'Official jq release assets not found' }
        Invoke-WebRequest -UseBasicParsing $asset.browser_download_url -OutFile '.tools/bin/jq.exe'
        Invoke-WebRequest -UseBasicParsing $checksums.browser_download_url -OutFile '.tools/jq-sha256sum.txt'
        $line = Get-Content '.tools/jq-sha256sum.txt' | Where-Object { $_ -match 'jq-windows-amd64.exe$' }
        if (-not $line -or (Get-FileHash '.tools/bin/jq.exe' -Algorithm SHA256).Hash -ne ($line -split '\s+')[0]) {
            throw 'jq download checksum mismatch'
        }
    }
    if (-not (Test-Path '.tide-pack/templates/shared/tide-doctor.sh')) {
        Invoke-WebRequest -UseBasicParsing 'https://mcp.tide.org/pack/templates.tgz' -OutFile '.tide-pack/templates.tgz'
        tar -xzf '.tide-pack/templates.tgz' -C '.tide-pack'
        if ($LASTEXITCODE -ne 0) { throw 'Tide pack extraction failed' }
    }
    if (-not (Test-Path '.env')) {
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $bytes = New-Object byte[] 32
        $rng.GetBytes($bytes)
        $adminPassword = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
        $rng.GetBytes($bytes)
        $databasePassword = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
        $rng.Dispose()
        $content = Get-Content '.env.example' -Raw
        $content = $content.Replace('KC_BOOTSTRAP_ADMIN_PASSWORD=', "KC_BOOTSTRAP_ADMIN_PASSWORD=$adminPassword")
        $content = $content.Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$databasePassword")
        $content = $content.Replace('DATABASE_URL=', "DATABASE_URL=postgresql://vault:${databasePassword}@localhost:5432/research_consent_vault?schema=public")
        [IO.File]::WriteAllText((Join-Path $projectRoot '.env'), $content.Replace("`r`n", "`n"))
        Write-Host 'Created .env with random credentials. Licence email and terms remain for the owner to fill in.'
    }
    if (-not $SkipInstall) {
        if (Test-Path 'package-lock.json') { npm.cmd ci } else { npm.cmd install }
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
    }
    Write-Host 'Project files prepared. See README.md for Docker, Tide account linking, and verification.'
} finally {
    Pop-Location
}
