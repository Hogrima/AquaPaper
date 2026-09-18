param([string]$Package = (Join-Path $PSScriptRoot '..\dist\AquaPaper'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$packageRoot = (Resolve-Path -LiteralPath $Package).Path
$setup = Join-Path $packageRoot 'installer\Install.ps1'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifacts = Join-Path $workspace 'artifacts'
$fixture = Join-Path $artifacts ('installer-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$script:checks = 0
function Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:checks++
}
function Run-Setup([string[]]$Arguments, [int]$ExpectedExit) {
    $output = & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $setup @Arguments 2>&1
    if ($LASTEXITCODE -ne $ExpectedExit) { throw "Unexpected installer exit $LASTEXITCODE : $output" }
    $script:checks++
}
function Same-File([string]$Relative) {
    return (Get-FileHash -LiteralPath (Join-Path $packageRoot $Relative)).Hash -eq (Get-FileHash -LiteralPath (Join-Path $destination $Relative)).Hash
}
$destination = Join-Path $fixture 'installed\AquaPaper'
Run-Setup @('-InstallDir', $destination, '-SkipShortcuts') 0
$marker = Get-Content -LiteralPath (Join-Path $destination '.aquapaper-install.json') -Raw | ConvertFrom-Json
Check ($marker.product -eq 'Hogrima.AquaPaper' -and $marker.directory -eq $destination) 'Installation ownership marker is invalid.'
foreach ($file in @('AquaPaper.exe', 'AquaPaper.runtimeconfig.json', 'web\assets\aquarium.png', 'README.ko.md', 'README.en.md', 'Install.cmd', 'Uninstall.cmd', 'licenses\WebView2\LICENSE.txt', 'licenses\dotnet\LICENSE.TXT')) {
    Check (Same-File $file) "Missing or corrupt installed file: $file"
}
Check (@($marker.shortcuts).Count -eq 0) 'Test must not modify real shortcuts.'
'old content' | Set-Content -LiteralPath (Join-Path $destination 'README.md')
Run-Setup @('-InstallDir', $destination, '-SkipShortcuts') 0
Check (Same-File 'README.md') 'Update did not replace old content.'

$foreign = Join-Path $fixture 'foreign\AquaPaper'
New-Item -ItemType Directory -Path $foreign -Force | Out-Null
$sentinel = Join-Path $foreign 'keep.txt'
'Keep this file' | Set-Content -LiteralPath $sentinel
Run-Setup @('-InstallDir', $foreign, '-SkipShortcuts') 1
Run-Setup @('-InstallDir', $foreign, '-Uninstall', '-ConfirmUninstall') 1
Check ((Get-Content -LiteralPath $sentinel -Raw).Trim() -eq 'Keep this file') 'An unrelated directory was modified.'
Run-Setup @('-InstallDir', $fixture, '-Uninstall', '-ConfirmUninstall') 1

# Verify the exact recursive-delete target stays within this test fixture before invoking uninstall.
$resolvedDestination = (Resolve-Path -LiteralPath $destination).Path
Check ($resolvedDestination.StartsWith($fixture + '\', [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedDestination) -eq 'AquaPaper') 'Unsafe uninstall test target.'
Run-Setup @('-InstallDir', $resolvedDestination, '-Uninstall', '-ConfirmUninstall') 0
Check (-not (Test-Path -LiteralPath $resolvedDestination)) 'Uninstall left the app directory behind.'
Check (Test-Path -LiteralPath $sentinel) 'Uninstall removed an unrelated file.'
Check (Test-Path -LiteralPath (Join-Path $packageRoot 'AquaPaper.exe')) 'Uninstall modified the source package.'
Write-Host "PASS: $script:checks installer checks (install, update, protected folders, uninstall)."
Write-Host "Retained test evidence: $fixture"
