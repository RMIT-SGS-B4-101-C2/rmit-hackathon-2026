# Reproduce the authorized Consent Vault login branding with Tide's official generator.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path '.tools/python/python3.exe')) {
        New-Item -ItemType Directory -Force '.tools' | Out-Null
        $manifest = Invoke-RestMethod 'https://www.python.org/ftp/python/3.13.17/windows-3.13.17.json'
        $artifact = $manifest.versions | Where-Object id -eq 'pythonembed-3.13-64' | Select-Object -First 1
        if (-not $artifact) { throw 'Official portable Python release not found' }
        curl.exe --fail --location --output '.tools/python-embed.zip' $artifact.url
        if ($LASTEXITCODE -ne 0) { throw 'Python download failed' }
        if ((Get-FileHash '.tools/python-embed.zip' -Algorithm SHA256).Hash -ne $artifact.hash.sha256) {
            throw 'Python checksum mismatch'
        }
        Expand-Archive -LiteralPath '.tools/python-embed.zip' -DestinationPath '.tools/python' -Force
        Copy-Item '.tools/python/python.exe' '.tools/python/python3.exe' -Force
    }
    $env:Path = "$projectRoot\.tools\python;$projectRoot\.tools\bin;$env:Path"
    & 'C:\Program Files\Git\bin\bash.exe' '.tide-pack/templates/enclave-branding/brand-tidecloak.sh' `
        --realm research-consent-vault --kind vault --accent 246950 --name 'Consent Vault' --url http://localhost:8080
    if ($LASTEXITCODE -ne 0) { throw 'Tide branding failed' }
} finally { Pop-Location }
