param(
  [Parameter(Mandatory=$true)][string]$Id,
  [Parameter(Mandatory=$true)][string]$Program,
  [string[]]$CommandArgs=@()
)
$v2Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$v2Tools=[IO.Path]::GetFullPath((Join-Path $v2Root '../.audit-tools'))
$v2Vcvars=Join-Path $v2Tools 'msvc/VC/Auxiliary/Build/vcvars64.bat'
if(Test-Path -LiteralPath $v2Vcvars){
  # Capture internally; never print the process environment (it may contain secrets).
  $v2Environment=& cmd.exe /d /s /c "`"`"$v2Vcvars`" >nul && set`""
  if($LASTEXITCODE -eq 0){
    foreach($v2Line in $v2Environment){
      if($v2Line -match '^(PATH|LIB|LIBPATH|INCLUDE|WindowsSdkDir|WindowsSDKVersion|VCINSTALLDIR|VSINSTALLDIR|VCToolsInstallDir|VCToolsVersion|UniversalCRTSdkDir|UCRTVersion)=(.*)$'){
        [Environment]::SetEnvironmentVariable($matches[1],$matches[2],'Process')
      }
    }
  }
}
if(Test-Path -LiteralPath (Join-Path $v2Tools 'cargo/bin')){
  $env:CARGO_HOME=Join-Path $v2Tools 'cargo'
  $env:RUSTUP_HOME=Join-Path $v2Tools 'rustup'
  $env:PATH=(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
}
$env:CARGO_TARGET_DIR=Join-Path $v2Root 'target'
$env:CARGO_TERM_COLOR='never'
$env:NO_COLOR='1'
Set-Location -LiteralPath $v2Root
$v2Start=[DateTimeOffset]::Now
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'evidence') -Force | Out-Null
$v2Output=Join-Path $PSScriptRoot ('evidence/'+$Id+'.txt')
& $Program @CommandArgs *>&1 | Tee-Object -FilePath $v2Output
$v2Exit=$LASTEXITCODE
if($null -eq $v2Exit){$v2Exit=0}
[ordered]@{id=$Id;command=(@($Program)+$CommandArgs)-join ' ';startedAt=$v2Start.ToString('o');finishedAt=[DateTimeOffset]::Now.ToString('o');exitCode=$v2Exit;cwd=$v2Root}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot ('evidence/'+$Id+'.json')) -Encoding utf8
exit $v2Exit
