param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$serverScript = Join-Path $PSScriptRoot 'local-server.ps1'
$watchdogScript = Join-Path $PSScriptRoot 'watchdog.ps1'
$stateRoot = Join-Path $env:ProgramData 'KuInfoekraan'
if(-not (Test-Path $serverScript)){throw "local-server.ps1 puudub: $serverScript"}
if(-not (Test-Path $watchdogScript)){throw "watchdog.ps1 puudub: $watchdogScript"}

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$serverArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$serverScript`" -Port 8765 -Root `"$(Join-Path $Root 'dist')`" -ConfigPath `"$(Join-Path $Root 'config.js')`" -StateRoot `"$stateRoot`""
$serverTask = New-ScheduledTask -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $serverArgs) -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -Principal (New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest)
Register-ScheduledTask -TaskName 'KU Infoekraan Server' -InputObject $serverTask -Force | Out-Null

$watchdogArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdogScript`" -Root `"$Root`" -StateRoot `"$stateRoot`""
$watchdogTask = New-ScheduledTask -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $watchdogArgs) -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME) -Settings $settings -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest)
Register-ScheduledTask -TaskName 'KU Infoekraan Watchdog' -InputObject $watchdogTask -Force | Out-Null

# Keela kioskikontol Edge DevTools. Käivitamine administraatorina on ajastatud ülesannete loomiseks niigi vajalik.
$policy = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
New-Item -Path $policy -Force | Out-Null
New-ItemProperty -Path $policy -Name DeveloperToolsAvailability -PropertyType DWord -Value 2 -Force | Out-Null
Write-Host 'Loodud ülesanded KU Infoekraan Server ja KU Infoekraan Watchdog. Edge DevTools on keelatud.'
