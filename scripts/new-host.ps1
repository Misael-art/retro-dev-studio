# Windows level-zero entrypoint; installers remain in bootstrap.ps1/host-manager.
#Requires -Version 5.1
param(
    [ValidateSet('Plan', 'Install', 'Check', 'Certify', 'Build', 'Run')]
    [string]$Mode = 'Plan',
    [switch]$Offline,
    [switch]$Certify,
    [switch]$Build,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs = @()
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$PinnedNode = (Get-Content -LiteralPath (Join-Path $ProjectRoot '.node-version') -Raw).Trim()
$CacheBase = if ($env:RDS_HOST_CACHE) { $env:RDS_HOST_CACHE } else { Join-Path $env:LOCALAPPDATA 'RetroDevStudio\cache' }
$NodeExe = Join-Path $CacheBase "bootstrap\node-v$PinnedNode-win-x64\node.exe"
if ($Mode -eq 'Plan' -and -not (Test-Path -LiteralPath $NodeExe) -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Read-only plan; Node is absent. Checkout: $ProjectRoot"
    Write-Host 'Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\new-host.ps1 -Mode Install -Certify -Build'
    Write-Host 'No software, corpus or credentials were installed. Windows x64 only.'
    exit 0
}
if ($Mode -eq 'Install') {
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($env:OS -ne 'Windows_NT' -or $architecture -ne 'AMD64') { throw 'Windows x64 required.' }
    if (-not $env:RDS_BUILD_JOBS) { $env:RDS_BUILD_JOBS = '2' }
    if ($env:RDS_BUILD_JOBS -notmatch '^[1-8]$') { throw 'RDS_BUILD_JOBS must be 1..8.' }
    $env:CARGO_BUILD_JOBS = $env:RDS_BUILD_JOBS
    if (-not $env:RDS_WORK_ROOT) { $env:RDS_WORK_ROOT = Join-Path $env:USERPROFILE 'RetroDevStudio-work' }
    if (-not [IO.Path]::IsPathRooted($env:RDS_WORK_ROOT)) { throw 'RDS_WORK_ROOT must be absolute.' }
    $work = [IO.Path]::GetFullPath($env:RDS_WORK_ROOT)
    $repo = [IO.Path]::GetFullPath($ProjectRoot)
    if ($work -eq [IO.Path]::GetFullPath($env:USERPROFILE) -or $work -eq [IO.Path]::GetPathRoot($work)) { throw 'Work root must be a dedicated subdirectory.' }
    if ($work -eq $repo -or $work.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Work root must be outside checkout.' }
    if ($work -match '(^|[\\/])\.[^\\/]*([\\/]|$)') { throw 'Use a non-hidden work root.' }
    $minimum = 35
    if ($env:RDS_MIN_FREE_GIB) {
        if ($env:RDS_MIN_FREE_GIB -notmatch '^[1-9][0-9]*$') { throw 'RDS_MIN_FREE_GIB must be an integer >=16.' }
        $minimum = [int]$env:RDS_MIN_FREE_GIB
    }
    if ($minimum -lt 16) { throw 'RDS_MIN_FREE_GIB must be >=16.' }
    foreach ($location in @($repo, $work, $CacheBase)) {
        $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($location)))
        if ($drive.AvailableFreeSpace -lt ($minimum * 1GB)) { throw "Insufficient free space at $location. No automatic deletion." }
    }
    $tmp = Join-Path $work 'tmp'
    $sessions = Join-Path $work 'sessions'
    New-Item -ItemType Directory -Force -Path $tmp, $sessions | Out-Null
    $env:TEMP = $tmp
    $env:TMP = $tmp
    $log = Join-Path $sessions ("bootstrap-" + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + "-$PID.log")
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'bootstrap.ps1'), '-Ensure', '-Profile', 'Full', '-SkipNpmCi')
    if ($Offline) { $arguments += '-Offline' }
    # PS 5.1 can promote redirected native stderr into NativeCommandError.
    # A transcript keeps the log without turning rustup progress into failure.
    Start-Transcript -LiteralPath $log -Force | Out-Null
    try {
        & powershell @arguments
        $bootstrapExit = $LASTEXITCODE
    } finally {
        Stop-Transcript | Out-Null
    }
    if ($bootstrapExit -ne 0) { exit $bootstrapExit }
}
if (-not (Test-Path -LiteralPath $NodeExe)) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node absent; run -Mode Install first.' }
    $NodeExe = $node.Source
}
$arguments = @((Join-Path $PSScriptRoot 'new-host.mjs'), ('--' + $Mode.ToLowerInvariant()))
if ($Offline) { $arguments += '--offline' }
if ($Certify) { $arguments += '--certify' }
if ($Build) { $arguments += '--build' }
if ($Mode -eq 'Run') { $arguments += $CommandArgs }
& $NodeExe @arguments
exit $LASTEXITCODE
