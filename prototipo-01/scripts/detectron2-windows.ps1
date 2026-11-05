# Executa Python no ambiente experimental e seleciona o compilador CUDA compatível.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PythonArgs)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.envs\detectree2\Scripts\python.exe'
$devcmd = 'C:\BuildTools\Arboriza2022\Common7\Tools\VsDevCmd.bat'
$cuda = 'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8'
foreach ($path in @($python, $devcmd, "$cuda\bin\nvcc.exe")) {
    if (!(Test-Path -LiteralPath $path)) { throw "Componente ausente: $path" }
}

$environment = & $env:ComSpec /d /s /c "`"$devcmd`" -arch=x64 -host_arch=x64 -vcvars_ver=14.38 >nul && set"
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ativar o MSVC 14.38.' }
foreach ($line in $environment) {
    if ($line -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
$env:CUDA_HOME = $cuda
$env:CUDA_PATH = $cuda
$env:PATH = "$cuda\bin;$(Split-Path -Parent $python);$env:PATH"
$env:TORCH_CUDA_ARCH_LIST = '12.0' # RTX 5070; não usar em outra GPU sem conferir.
$env:MAX_JOBS = '2'
$env:DISTUTILS_USE_SDK = '1'
$env:MSSdk = '1'
$env:PYTHONUTF8 = '1'
$env:VSLANG = '1033'

if (!$PythonArgs) { $PythonArgs = @("$PSScriptRoot\check_detectron2.py") }
& $python @PythonArgs
exit $LASTEXITCODE
