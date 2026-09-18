param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\AquaPaper'),
    [switch]$Launch,
    [switch]$SkipShortcuts,
    [switch]$Uninstall,
    [switch]$ConfirmUninstall
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Say([string]$Korean, [string]$English) {
    Write-Host $Korean
    Write-Host $English -ForegroundColor DarkGray
}
function Read-Marker([string]$Path) {
    $file = Join-Path $Path '.aquapaper-install.json'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
    $data = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($data.product -ne 'Hogrima.AquaPaper' -or $data.directory -ne $Path) {
        throw 'Invalid installation marker. / 설치 폴더 확인에 실패했습니다.'
    }
    return $data
}
function Assert-Stopped([string]$Path) {
    $running = Get-Process AquaPaper -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $Path 'AquaPaper.exe') }
    if ($running) { throw 'Exit AquaPaper from its tray menu, then retry. / 트레이에서 AquaPaper를 종료한 뒤 다시 시도하세요.' }
}
function Add-Shortcut([string]$Path, [string]$Target) {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($Path)
    $link.TargetPath = $Target
    $link.WorkingDirectory = Split-Path -Parent $Target
    $link.IconLocation = $Target
    $link.Description = 'AquaPaper - Interactive aquarium wallpaper'
    $link.Save()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}

try {
    $root = [IO.Path]::GetFullPath($InstallDir).TrimEnd([IO.Path]::DirectorySeparatorChar)
    # Installation and deletion must target this app's own leaf directory, never a parent.
    if ((Split-Path -Leaf $root) -ne 'AquaPaper') { throw 'The destination folder must be named AquaPaper. / 설치 폴더 이름은 AquaPaper여야 합니다.' }
    $blocked = @([IO.Path]::GetPathRoot($root), $env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA, $env:ProgramFiles, [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
    foreach ($path in $blocked) { if ($path -and $root -eq $path.TrimEnd('\')) { throw 'Unsafe installation target.' } }
    # Do not follow a directory junction/symlink when copying or uninstalling.
    $parent = $root
    while ($parent) {
        if (Test-Path -LiteralPath $parent) {
            if ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Use a regular folder, not a linked directory. / 연결 폴더에는 설치할 수 없습니다.' }
        }
        $parent = Split-Path -Parent $parent
    }
    $marker = Read-Marker $root
    if ($Uninstall) {
        if (-not $marker) { throw 'No AquaPaper installation was found here. / 이 위치에서 설치된 AquaPaper를 찾지 못했습니다.' }
        Assert-Stopped $root
        if (-not $ConfirmUninstall) {
            Say '앱 파일과 바로가기를 삭제합니다. 설정은 보관합니다.' 'Remove the app and its shortcuts? Your settings will be kept.'
            if ((Read-Host '계속 / Continue? [y/N]') -notin @('y','Y')) { Say '취소했습니다.' 'Cancelled.'; exit 0 }
        }
        foreach ($path in @($marker.shortcuts)) {
            if ((Test-Path -LiteralPath $path -PathType Leaf) -and [IO.Path]::GetExtension($path) -eq '.lnk') {
                $shell = New-Object -ComObject WScript.Shell
                $target = $shell.CreateShortcut($path).TargetPath
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
                if ($target -eq (Join-Path $root 'AquaPaper.exe')) { Remove-Item -LiteralPath $path -Force }
            }
        }
        # $root is absolute, has the required leaf name, no linked ancestors, and a matching marker.
        Remove-Item -LiteralPath $root -Recurse -Force
        Say 'AquaPaper를 제거했습니다. 수족관 설정은 그대로 보관됩니다.' 'AquaPaper was removed. Aquarium preferences were preserved.'
        exit 0
    }

    $source = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
    if ($source -eq $root -or $source.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or $root.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Choose an installation folder outside the extracted download. / 압축을 푼 폴더 밖에 설치하세요.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'AquaPaper.exe') -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path $source 'web\index.html') -PathType Leaf)) {
        throw 'Download and extract AquaPaper-Windows-x64.zip from GitHub Releases first. The source-code ZIP is not an installer. / GitHub Releases의 실행용 ZIP을 먼저 다운로드하고 압축을 풀어 주세요.'
    }
    if (-not $marker -and (Test-Path -LiteralPath $root) -and @(Get-ChildItem -LiteralPath $root -Force).Count -gt 0) {
        throw 'The destination contains other files. Choose a new AquaPaper folder. / 대상 폴더에 다른 파일이 있습니다.'
    }
    Assert-Stopped $root
    Say 'AquaPaper를 설치하고 있습니다…' 'Installing AquaPaper…'
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $links = @()
    if ($marker) { $links = @($marker.shortcuts) }
    # Mark the validated app folder first so an interrupted copy can be retried.
    @{ product='Hogrima.AquaPaper'; directory=$root; shortcuts=@($links) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.aquapaper-install.json') -Encoding UTF8
    foreach ($entry in Get-ChildItem -LiteralPath $source -Force) {
        if ($entry.Name -eq '.aquapaper-install.json') { continue }
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The package contains a linked entry.' }
        Copy-Item -LiteralPath $entry.FullName -Destination $root -Recurse -Force
    }
    if (-not $SkipShortcuts) {
        $desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AquaPaper.lnk'
        $programs = Join-Path ([Environment]::GetFolderPath('Programs')) 'AquaPaper.lnk'
        foreach ($path in @($desktop, $programs)) { Add-Shortcut $path (Join-Path $root 'AquaPaper.exe'); $links += $path }
        @{ product='Hogrima.AquaPaper'; directory=$root; shortcuts=@($links | Select-Object -Unique) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.aquapaper-install.json') -Encoding UTF8
    }
    Say '설치가 완료되었습니다. 관리자 권한이나 .NET 별도 설치가 필요하지 않습니다.' 'Installation complete. No administrator rights or separate .NET installation are needed.'
    Write-Host $root -ForegroundColor Green
    Say '실행에는 Microsoft Edge WebView2 Runtime이 필요합니다.' 'Microsoft Edge WebView2 Runtime is required to run the app.'
    Write-Host 'https://developer.microsoft.com/microsoft-edge/webview2/'
    if ($Launch) {
        if (Get-Process AquaPaper -ErrorAction SilentlyContinue) { Say 'AquaPaper가 이미 실행 중입니다. 트레이에서 종료한 뒤 설치된 바로가기로 여세요.' 'AquaPaper is already running. Exit it from the tray, then use the installed shortcut.' }
        else { Start-Process -FilePath (Join-Path $root 'AquaPaper.exe') }
    }
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
