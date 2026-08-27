param(
  [int]$Port = 8765,
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [int]$CheckSeconds = 30,
  [int]$HeartbeatMaxAgeSeconds = 210,
  [string]$StateRoot = (Join-Path $env:ProgramData 'KuInfoekraan')
)
$ErrorActionPreference = 'Continue'
$health = "http://127.0.0.1:$Port/healthz"
$startScript = Join-Path $PSScriptRoot 'start-kiosk.cmd'
$heartbeat = Join-Path $StateRoot 'renderer-heartbeat.txt'
$logDir = Join-Path $StateRoot 'logs'
$log = Join-Path $logDir 'watchdog.log'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$lastRestart = Get-Date # käivituse järel 210 s armuaeg renderdaja esimese heartbeatini

function Rotate-Log {
  try { if((Test-Path $log) -and (Get-Item $log).Length -ge 1MB){Move-Item $log ($log+'.1') -Force} } catch {}
}
function Write-Log([string]$Message) { Rotate-Log; Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" }
function Test-Server {
  try { $r=Invoke-WebRequest -UseBasicParsing -Uri $health -TimeoutSec 2; return $r.StatusCode -eq 200 -and $r.Content.Trim() -eq 'KU-INFOEKRAAN-OK' } catch { return $false }
}
function Get-KioskProcesses {
  $endpointPattern = [regex]::Escape("127.0.0.1:$Port")
  @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -match '--kiosk' -and $_.CommandLine -match $endpointPattern
  })
}
function Test-Heartbeat {
  if(-not (Test-Path -LiteralPath $heartbeat)){ return ((Get-Date) - $lastRestart).TotalSeconds -lt $HeartbeatMaxAgeSeconds }
  return ((Get-Date) - (Get-Item -LiteralPath $heartbeat).LastWriteTime).TotalSeconds -le $HeartbeatMaxAgeSeconds
}

while($true){
  try {
    $serverOk = Test-Server
    $processes = Get-KioskProcesses
    $edgeOk = $processes.Count -gt 0
    $heartbeatOk = Test-Heartbeat
    $cooldownOk = ((Get-Date) - $lastRestart).TotalSeconds -ge 120
    if(( -not $serverOk -or -not $edgeOk -or -not $heartbeatOk) -and $cooldownOk){
      Write-Log "Taaskäivitan infoekraani. serverOk=$serverOk edgeOk=$edgeOk heartbeatOk=$heartbeatOk"
      if($edgeOk -and -not $heartbeatOk){
        $processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      }
      Start-Process -FilePath $startScript -WorkingDirectory $Root -WindowStyle Hidden
      $lastRestart = Get-Date
      Start-Sleep -Seconds 10
    }
  } catch { Write-Log "Valvekoera viga: $($_.Exception.Message)" }
  Start-Sleep -Seconds ([Math]::Max(10,$CheckSeconds))
}
