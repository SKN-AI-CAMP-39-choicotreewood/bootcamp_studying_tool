$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$project = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $project '.runtime'
$node = Join-Path $runtime 'node.exe'
$launcher = Join-Path $runtime 'Bootcamp Studying Tool.exe'
$version = 'v24.22.3'
$architecture = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
    'X64' { 'win-x64' }
    'Arm64' { 'win-arm64' }
    default { throw 'This Node.js runtime supports Windows x64 and ARM64.' }
}

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$feed = "https://nodejs.org/dist/$version"
$checksums = (Invoke-WebRequest -Uri "$feed/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 30).Content
$binary = "$architecture/node.exe"
$pattern = '^([a-fA-F0-9]{64})\s+\*?' + [regex]::Escape($binary) + '$'
$checksum = ($checksums -split '\r?\n' | Select-String -Pattern $pattern).Matches.Groups[1].Value
if (-not $checksum) { throw "The Node.js release has no SHA-256 entry for $binary." }

if (-not (Test-Path -LiteralPath $node) -or (Get-FileHash -LiteralPath $node).Hash -ne $checksum) {
    $download = Join-Path $runtime 'node.exe.download'
    try {
        Invoke-WebRequest -Uri "$feed/$binary" -UseBasicParsing -TimeoutSec 90 -OutFile $download
        if ((Get-FileHash -LiteralPath $download).Hash -ne $checksum) { throw 'Node.js download failed SHA-256 verification.' }
        Move-Item -LiteralPath $download -Destination $node -Force
    } finally {
        if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download -Force }
    }
}
if ((& $node --version) -ne $version) { throw 'The local Node.js executable did not report the expected version.' }

$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /codepage:65001 /target:winexe /reference:System.Windows.Forms.dll "/out:$launcher" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not build the Windows launcher.' }

$started = Start-Process -FilePath $launcher -ArgumentList '--background' -WindowStyle Hidden -PassThru
if (-not $started.WaitForExit(25000) -or $started.ExitCode -ne 0) { throw 'The local server did not start on port 4173.' }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/health' -TimeoutSec 5
if ($health.app -ne 'bootcamp-studying-tool') { throw 'The health check failed.' }

# The current user's Startup shortcut invokes the same launcher without opening a browser.
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Bootcamp Studying Tool.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.Arguments = '--background'
$shortcut.WorkingDirectory = $project
$shortcut.Description = 'Start the local Bootcamp Studying Tool server at sign-in'
$shortcut.Save()

Write-Output "Node.js $version verified by SHA-256. Startup shortcut saved at $shortcutPath"
Write-Output 'Local app is ready at http://127.0.0.1:4173/'
