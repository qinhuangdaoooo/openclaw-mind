@echo off
setlocal

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALL=%%i"
)

if defined VSINSTALL (
  set "VCVARS=%VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat"
  if exist "%VCVARS%" (
    call "%VCVARS%" >nul
    if errorlevel 1 exit /b %ERRORLEVEL%
    link.exe %*
    exit /b %ERRORLEVEL%
  )
)

for /f "usebackq delims=" %%i in (`rustc --print sysroot`) do set "SYSROOT=%%i"
if not defined SYSROOT (
  echo Failed to resolve Rust sysroot. 1>&2
  exit /b 1
)

set "LLD=%SYSROOT%\lib\rustlib\x86_64-pc-windows-msvc\bin\gcc-ld\lld-link.exe"
if not exist "%LLD%" (
  set "LLD=%SYSROOT%\lib\rustlib\x86_64-pc-windows-msvc\bin\rust-lld.exe"
)
if not exist "%LLD%" (
  echo No Rust-provided linker found under "%SYSROOT%". 1>&2
  exit /b 1
)

"%LLD%" %*
