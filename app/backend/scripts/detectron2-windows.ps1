# Executa Python no ambiente da API com o compilador/CUDA validados para a RTX 5070.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$PythonArgs)

$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $backendRoot '.venv\Scripts\python.exe'
$devcmd = if ($env:ARBORIZA_VSDEVCMD) { $env:ARBORIZA_VSDEVCMD } else { 'C:\BuildTools\Arboriza2022\Common7\Tools\VsDevCmd.bat' }
$cuda = if ($env:ARBORIZA_CUDA_HOME) { $env:ARBORIZA_CUDA_HOME } else { 'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8' }
foreach ($path in @($python, $devcmd, (Join-Path $cuda 'bin\nvcc.exe'))) {
    if (!(Test-Path -LiteralPath $path)) { throw "Componente ausente: $path" }
}
if (!$PythonArgs) { throw 'Passe ao menos um argumento Python, por exemplo: -m pip install <origem>.' }

$environment = & $env:ComSpec /d /s /c "`"$devcmd`" -arch=x64 -host_arch=x64 -vcvars_ver=14.38 >nul && set"
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ativar o MSVC 14.38.' }
foreach ($line in $environment) {
    if ($line -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
$env:CUDA_HOME = $cuda
$env:CUDA_PATH = $cuda
$env:PATH = "$(Join-Path $cuda 'bin');$env:PATH"
$env:TORCH_CUDA_ARCH_LIST = '12.0' # RTX 5070; confira antes de usar outra GPU.
$env:MAX_JOBS = '2'
$env:DISTUTILS_USE_SDK = '1'
$env:MSSdk = '1'
$env:PYTHONUTF8 = '1'
$env:VSLANG = '1033'

& $python @PythonArgs
exit $LASTEXITCODE
