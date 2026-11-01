param([switch]$Build)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot
$qaRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot '.local/installer-qa'))
$qaGuid = '1d522e03-7f3a-4ef6-926f-42c84d3237be'
$registry = "HKCU:\Software\$qaGuid"
$installDir = Join-Path $qaRoot 'installed/CodeboundInstallerQA'
$wrongDir = Join-Path $qaRoot 'must-not-be-used/CodeboundInstallerQA'
$currentVersion = (Get-Content package.json -Raw -Encoding utf8 | ConvertFrom-Json).version
if (Test-Path -LiteralPath $registry) { throw 'QA installation already exists; inspect it before testing.' }
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
if ($Build) {
  $common = @('--win','nsis','--x64','--publish','never', '-c.appId=studio.codebound.installer-qa', '-c.productName=CodeboundInstallerQA', "-c.nsis.guid=$qaGuid", '-c.nsis.runAfterFinish=false', '-c.nsis.createDesktopShortcut=false', '-c.nsis.createStartMenuShortcut=false')
  & ./node_modules/.bin/electron-builder.cmd @common '-c.directories.output=.local/installer-qa/baseline' '-c.nsis.include=build/qa-baseline.nsh' '-c.extraMetadata.version=0.1.0-alpha.3'
  if ($LASTEXITCODE -ne 0) { throw 'Baseline installer build failed.' }
  & ./node_modules/.bin/electron-builder.cmd @common '-c.directories.output=.local/installer-qa/current' '-c.nsis.include=build/qa-installer.nsh'
  if ($LASTEXITCODE -ne 0) { throw 'Current installer build failed.' }
}
$baseline = Join-Path $qaRoot 'baseline/Codebound-0.1.0-alpha.3-Setup.exe'
$current = Join-Path $qaRoot "current/Codebound-$currentVersion-Setup.exe"
if (!(Test-Path -LiteralPath $baseline) -or !(Test-Path -LiteralPath $current)) { throw 'Build QA installers first using -Build.' }
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class InstallerQAWindow {
 public delegate bool EnumProc(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc callback,IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder text,int size);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int size);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls,string title);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 public static IntPtr Window(int pid) {
  IntPtr result=IntPtr.Zero;
  EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);var name=new StringBuilder(64);GetClassName(h,name,64);if(owner==pid&&name.ToString()=="#32770"){result=h;return false;}return true;},IntPtr.Zero);
  return result;
 }
 public static bool HasDirectoryEdit(IntPtr window) {
  bool found=false;
  EnumChildWindows(window,(h,p)=>{var text=new StringBuilder(64);GetClassName(h,text,64);if(text.ToString()=="Edit")found=true;return true;},IntPtr.Zero);
  return found;
 }
}
'@
function Require([bool]$condition,[string]$message) { if (!$condition) { throw $message } }
function Assert-FreshWizard {
  $process = Start-Process -FilePath $current -ArgumentList "/D=$installDir" -WindowStyle Hidden -PassThru
  try {
    $found = $false
    $advanced = $false
    for ($i=0; $i -lt 100; $i++) {
      if ($process.HasExited) { break }
      $window = [InstallerQAWindow]::Window($process.Id)
      if ($window -ne [IntPtr]::Zero -and [InstallerQAWindow]::HasDirectoryEdit($window)) { $found=$true; break }
      if (!$advanced -and $window -ne [IntPtr]::Zero) {
        $next=[InstallerQAWindow]::GetDlgItem($window,1)
        $caption=New-Object Text.StringBuilder 100
        [InstallerQAWindow]::GetWindowText($next,$caption,100) | Out-Null
        if ($caption.ToString() -match 'Next|下一步') {
          [InstallerQAWindow]::SendMessage($next,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
          $advanced=$true
        }
      }
      Start-Sleep -Milliseconds 100
    }
    Require $found 'Fresh installation did not display the directory wizard.'
  } finally {
    # This is our own QA installer, stopped before the Install button is pressed.
    if (!$process.HasExited) { Stop-Process -Id $process.Id -Force; $process.WaitForExit() }
  }
}
function Invoke-AutomaticUpgrade {
  Remove-ItemProperty -LiteralPath $registry -Name CodeboundQAUpgrade -ErrorAction SilentlyContinue
  $process = Start-Process -FilePath $current -ArgumentList "/D=$wrongDir" -WindowStyle Hidden -PassThru
  try {
    $finished=$false
    for ($i=0; $i -lt 1200; $i++) {
      if ($process.HasExited) { break }
      $window=[InstallerQAWindow]::Window($process.Id)
      Require (!$window -or ![InstallerQAWindow]::HasDirectoryEdit($window)) 'Upgrade unexpectedly asked for an install directory.'
      $state=Get-ItemProperty -LiteralPath $registry -ErrorAction SilentlyContinue
      if ($state.CodeboundQAUpgrade -eq '1') { $finished=$true; break }
      Start-Sleep -Milliseconds 100
    }
    Require $finished 'Automatic upgrade did not finish.'
    for ($i=0; $i -lt 50 -and !$process.HasExited; $i++) {
      $window=[InstallerQAWindow]::Window($process.Id)
      $finish=[InstallerQAWindow]::GetDlgItem($window,1)
      if ($finish -and [InstallerQAWindow]::IsWindowEnabled($finish)) { [InstallerQAWindow]::SendMessage($finish,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null }
      Start-Sleep -Milliseconds 100
    }
    Require ($process.WaitForExit(10000)) 'QA finish page did not close.'
    Require ($process.ExitCode -eq 0) 'Upgrade returned a failure code.'
    $location=(Get-ItemProperty -LiteralPath $registry).InstallLocation
    Require ($location.TrimEnd('\') -eq $installDir.TrimEnd('\')) 'Upgrade changed the registered directory.'
    # NSIS can create /D's empty working directory before .onInit. Only the
    # registered destination may receive application files during an upgrade.
    Require (!(Test-Path -LiteralPath (Join-Path $wrongDir 'CodeboundInstallerQA.exe'))) 'Upgrade incorrectly relocated the installation.'
    $expected=(Get-FileHash (Join-Path $qaRoot 'current/win-unpacked/resources/app.asar')).Hash
    $actual=(Get-FileHash (Join-Path $installDir 'resources/app.asar')).Hash
    Require ($expected -eq $actual) 'Installed application differs from the upgrade payload.'
  } finally {
    if (!$process.HasExited) { Stop-Process -Id $process.Id -Force; $process.WaitForExit() }
  }
}
$report=[ordered]@{}
$realSave=Join-Path $env:APPDATA 'Codebound/progress.v1.json'
$realSaveHash=if (Test-Path -LiteralPath $realSave) {(Get-FileHash $realSave).Hash} else {$null}
$fixtureFolder=Join-Path $env:APPDATA 'CodeboundInstallerQA'
$fixtureFile=Join-Path $fixtureFolder 'progress.v1.json'
if (Test-Path -LiteralPath $fixtureFile) { throw 'QA save fixture already exists; inspect it before testing.' }
$stub=Join-Path $qaRoot 'CodeboundInstallerQA.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler '/nologo' '/target:winexe' '/codepage:65001' "/out:$stub" (Join-Path $PSScriptRoot 'fixtures/installer-window.cs')
if ($LASTEXITCODE -ne 0) { throw 'QA window compiler failed.' }
$game=$null
try {
  Assert-FreshWizard
  $report.freshWizard=$true
  $process=Start-Process -FilePath $baseline -ArgumentList '/S','/currentuser',"/D=$installDir" -WindowStyle Hidden -Wait -PassThru
  Require ($process.ExitCode -eq 0) 'Baseline install failed.'
  $uninstallKey="HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$qaGuid"
  Require ((Get-ItemProperty -LiteralPath $uninstallKey).DisplayVersion -eq '0.1.0-alpha.3') 'Baseline version is incorrect.'
  New-Item -ItemType Directory -Path $fixtureFolder -Force | Out-Null
  '{"schemaVersion":1,"completed":{"fixture":{"runs":2}},"drafts":{"fixture":"print(1)"}}' | Set-Content -LiteralPath $fixtureFile -Encoding utf8
  $fixtureHash=(Get-FileHash $fixtureFile).Hash
  $marker=Join-Path $qaRoot 'graceful-save.txt'
  if (Test-Path -LiteralPath $marker) { Remove-Item -LiteralPath $marker }
  Copy-Item -LiteralPath $stub -Destination (Join-Path $installDir 'CodeboundInstallerQA.exe') -Force
  $game=Start-Process -FilePath (Join-Path $installDir 'CodeboundInstallerQA.exe') -ArgumentList $marker -WindowStyle Hidden -PassThru
  for ($i=0; $i -lt 50; $i++) {
    if ([InstallerQAWindow]::FindWindow('Chrome_WidgetWin_1','CodeboundInstallerQA · 码境远征') -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 100
  }
  Invoke-AutomaticUpgrade
  Require ($game.WaitForExit(5000)) 'The QA app did not close normally.'
  Require ((Test-Path -LiteralPath $marker) -and (Get-Content -LiteralPath $marker -Raw) -eq 'saved') 'Upgrade did not allow the app to save before closing.'
  $report.gracefulClose=$true
  Require ((Get-FileHash $fixtureFile).Hash -eq $fixtureHash) 'Upgrade changed the QA save.'
  $report.upgradeExistingPath=$true
  $report.savePreserved=$true
  Invoke-AutomaticUpgrade
  Require ((Get-FileHash $fixtureFile).Hash -eq $fixtureHash) 'Same-version repair changed the QA save.'
  $report.sameVersionRepair=$true
  $exe=Join-Path $installDir 'CodeboundInstallerQA.exe'
  $disabled=Join-Path $installDir 'CodeboundInstallerQA.disabled'
  Require ($exe.StartsWith($qaRoot+[IO.Path]::DirectorySeparatorChar)) 'QA executable is outside the fixture workspace.'
  Move-Item -LiteralPath $exe -Destination $disabled
  try { Assert-FreshWizard; $report.staleRegistrationFallsBack=$true }
  finally { Move-Item -LiteralPath $disabled -Destination $exe }
} finally {
  if ($game -and !$game.HasExited) { Stop-Process -Id $game.Id -Force; $game.WaitForExit() }
  if (Test-Path -LiteralPath $registry) {
    $location=(Get-ItemProperty -LiteralPath $registry).InstallLocation
    $resolved=[IO.Path]::GetFullPath($location)
    Require ($resolved.StartsWith($qaRoot+[IO.Path]::DirectorySeparatorChar)) 'Refusing to uninstall outside the QA workspace.'
    $uninstaller=Join-Path $resolved 'Uninstall CodeboundInstallerQA.exe'
    if (Test-Path -LiteralPath $uninstaller) {
      $cleanup=Start-Process -FilePath $uninstaller -ArgumentList '/S','/KEEP_APP_DATA',"_?=$resolved" -WindowStyle Hidden -Wait -PassThru
      Require ($cleanup.ExitCode -eq 0) 'QA uninstall failed.'
    }
  }
  if (Test-Path -LiteralPath $fixtureFile) { Remove-Item -LiteralPath $fixtureFile }
}
Require (!(Test-Path -LiteralPath $registry)) 'QA registry entry was not removed.'
if ($realSaveHash) { Require ((Get-FileHash $realSave).Hash -eq $realSaveHash) 'The real player save changed during QA.' }
$report.realSaveUnchanged=$true
$report.cleanup=$true
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot 'report.json') -Encoding utf8
$report | ConvertTo-Json
