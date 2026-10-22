#Requires -RunAsAdministrator
# Enables the Windows features required by WSL without rebooting the machine.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Start-Transcript -Path (Join-Path $projectRoot '.tools/windows-features.log') -Force
try {
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart | Select-Object FeatureName,RestartNeeded
    Get-CimInstance Win32_Processor | Select-Object Name,VirtualizationFirmwareEnabled,SecondLevelAddressTranslationExtensions
    Write-Host 'No restart performed. Restart Windows manually if the feature reports RestartNeeded.'
} finally {
    Stop-Transcript
}
