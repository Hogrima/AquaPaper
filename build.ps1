param(
    [switch]$Portable,
    [switch]$Zip,
    [switch]$NoRestore,
    [string]$RuntimeVersion = '10.0.12'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location -LiteralPath $PSScriptRoot
try {
    # Separate output folders prevent bundled runtimes leaking into a framework-dependent build.
    $output = if ($Portable) { 'dist\AquaPaper' } else { 'dist\framework-dependent\AquaPaper' }
    $publishArgs = @('publish', 'AquaPaper.csproj', '-c', 'Release', '-r', 'win-x64',
        '--self-contained', $Portable.IsPresent.ToString().ToLowerInvariant(), '-o', $output,
        "-p:RuntimeFrameworkVersion=$RuntimeVersion")
    if ($NoRestore) { $publishArgs += '--no-restore' }
    & dotnet @publishArgs
    if ($LASTEXITCODE -ne 0) { throw 'AquaPaper build failed.' }

    foreach ($file in @('README.md', 'README.ko.md', 'README.en.md', 'THIRD-PARTY-NOTICES.md', 'Install.cmd', 'Uninstall.cmd')) {
        Copy-Item -LiteralPath $file -Destination $output -Force
    }
    foreach ($folder in @('docs', 'installer')) {
        Copy-Item -LiteralPath $folder -Destination $output -Recurse -Force
    }

    # Resolve licenses from the same package cache that the build used.
    $assets = Get-Content -LiteralPath 'obj\project.assets.json' -Raw | ConvertFrom-Json
    function Find-PackageFile([string]$RelativePath) {
        foreach ($cache in $assets.packageFolders.PSObject.Properties.Name) {
            $candidate = Join-Path $cache $RelativePath
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
        throw "Missing dependency license: $RelativePath"
    }
    [xml]$project = Get-Content -LiteralPath 'AquaPaper.csproj'
    $webviewVersion = ($project.Project.ItemGroup.PackageReference | Where-Object Include -eq 'Microsoft.Web.WebView2').Version
    $sdkLicenses = Join-Path $output 'licenses\WebView2'
    New-Item -ItemType Directory -Path $sdkLicenses -Force | Out-Null
    foreach ($file in @('LICENSE.txt', 'NOTICE.txt')) {
        Copy-Item -LiteralPath (Find-PackageFile "microsoft.web.webview2\$webviewVersion\$file") -Destination $sdkLicenses -Force
    }
    if ($Portable) {
        $runtimeLicenses = Join-Path $output 'licenses\dotnet'
        New-Item -ItemType Directory -Path $runtimeLicenses -Force | Out-Null
        foreach ($file in @('LICENSE.TXT', 'THIRD-PARTY-NOTICES.TXT')) {
            Copy-Item -LiteralPath (Find-PackageFile "microsoft.netcore.app.runtime.win-x64\$RuntimeVersion\$file") -Destination $runtimeLicenses -Force
        }
        Copy-Item -LiteralPath (Find-PackageFile "microsoft.windowsdesktop.app.runtime.win-x64\$RuntimeVersion\LICENSE") -Destination (Join-Path $runtimeLicenses 'WindowsDesktop-LICENSE.txt') -Force
    }
    if ($Zip) {
        $archive = if ($Portable) { 'dist\AquaPaper-Windows-x64.zip' } else { 'dist\AquaPaper-Windows-x64-framework-dependent.zip' }
        Compress-Archive -LiteralPath $output -DestinationPath $archive -CompressionLevel Optimal -Force
        $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $(Split-Path -Leaf $archive)" | Set-Content -LiteralPath "$archive.sha256" -Encoding ASCII
        Write-Host "Package: $archive"
    }
    Write-Host "Ready: $output\AquaPaper.exe"
} finally {
    Pop-Location
}
