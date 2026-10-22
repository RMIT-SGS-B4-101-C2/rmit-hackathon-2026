# Installs Docker Desktop for this user. Does not accept Docker's agreement or restart Windows.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $projectRoot '.tools/Docker Desktop Installer.exe'
New-Item -ItemType Directory -Force (Join-Path $projectRoot '.tools') | Out-Null
if (-not (Test-Path -LiteralPath $installer)) {
    curl.exe --fail --location --output $installer 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
    if ($LASTEXITCODE -ne 0) { throw 'Docker installer download failed' }
}
$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker Inc') {
    throw 'Docker installer signature verification failed'
}
$process = Start-Process -FilePath $installer -ArgumentList 'install','--user','--quiet','--backend=wsl-2' -WindowStyle Hidden -PassThru
$process.WaitForExit()
if ($process.ExitCode -ne 0) {
    throw "Docker installation failed ($($process.ExitCode)). Check LOCALAPPDATA\Docker\install-log.txt; enable Virtual Machine Platform and restart Windows if required."
}
Write-Host 'Docker Desktop installed. Open it and review its first-run agreement, then wait for the engine.'
