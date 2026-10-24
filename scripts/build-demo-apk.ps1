<#
  데모(테스트) APK 빌드 스크립트 — 내 담당 화면을 예시 데이터로 체험하는 설치용 APK(AAB 아님)를 만든다.

  사용:  powershell -ExecutionPolicy Bypass -File scripts\build-demo-apk.ps1
  결과:  <프로젝트>\dist\ReelSpot-Demo.apk

  하는 일
   1) 프로젝트를 짧은 경로(WorkDir)로 복사한다. OneDrive 의 긴 경로·동기화가 Android 빌드(260자 경로 제한)를
      깨뜨리는 일을 막고, 원본 프로젝트에 android/ 폴더를 만들지 않기 위해서다.
      .env 는 복사하지 않는다 → Supabase 주소·키 등 실제 서비스 설정이 APK 에 들어가지 않는다.
   2) APP_VARIANT=demo, EXPO_PUBLIC_DEMO_MODE=1 로 expo prebuild → gradlew assembleRelease.
      앱 이름 "AT THAT PLACE 테스트(데모)", 패키지 com.reelspot.app.demo (기존 앱과 따로 설치됨).
   3) 개발 서버(Metro) 없이 실행되도록 JS 번들을 APK 안에 넣는다(release). 서명은 Expo 기본 디버그 키라
      테스트 배포용이다(스토어 배포용 아님).
   4) 빌드 후 패키지명·앱 이름·번들 안의 비밀 값 유무를 점검한다.

  준비물(없으면 docs/demo-apk.md 참고): JDK 17, Android SDK(platform 36, build-tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1)
  카카오 지도 JavaScript 키를 APK 에 넣으려면 -IncludeKakaoKey (기본은 넣지 않음; 예시 검색만 동작).
#>
param(
  [string]$WorkDir = 'C:\b\reelspot-demo',
  [string]$AndroidHome = 'C:\android-dev\sdk',
  [string]$JavaHome = 'C:\android-dev\jdk\jdk-17.0.20.1+1',
  # 휴대폰(arm64-v8a)과 에뮬레이터(x86_64)용. 구형 32비트 폰은 armeabi-v7a 를 추가한다.
  [string]$Abis = 'arm64-v8a,x86_64',
  [switch]$IncludeKakaoKey,
  # 이미 만든 android 프로젝트를 재사용해 JS/자산 변경만 빠르게 다시 빌드한다(처음 한 번은 쓰지 않는다).
  [switch]$Incremental
)

$ErrorActionPreference = 'Stop'
$proj = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Run($file, $arguments) {
  & $file @arguments
  if ($LASTEXITCODE -ne 0) { throw "실패(종료 코드 $LASTEXITCODE): $file $($arguments -join ' ')" }
}

foreach ($path in @($JavaHome, $AndroidHome)) {
  if (-not (Test-Path $path)) { throw "필요한 경로가 없습니다: $path  (docs/demo-apk.md 의 준비물 설치를 먼저 하세요)" }
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:ANDROID_SDK_ROOT = $AndroidHome
$env:Path = "$JavaHome\bin;$AndroidHome\platform-tools;$env:Path"

Step "1/4 프로젝트 복사 → $WorkDir (.env 제외)"
New-Item -ItemType Directory -Force $WorkDir | Out-Null
# /MIR 은 목적지를 원본과 같게 맞춘다. 제외 폴더(android 등)는 지우지도 복사하지도 않는다.
# 제외 폴더는 반드시 전체 경로로 적는다. 이름만 적으면 node_modules 안의 dist 같은 같은 이름 폴더까지 빠진다.
$exclude = '.git', '.expo', 'android', 'ios', 'dist', '.vscode' | ForEach-Object { Join-Path $proj $_ }
robocopy $proj $WorkDir /MIR /XD $exclude /XF .env .env.* /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 실패 ($LASTEXITCODE)" }
$global:LASTEXITCODE = 0

Step '2/4 환경변수 설정 (데모 모드, 서비스 키 제거)'
# 현재 셸에 실수로 남아 있을 수 있는 서비스 설정이 번들에 들어가지 않도록 지운다.
Get-ChildItem Env: | Where-Object { $_.Name -like 'EXPO_PUBLIC_*' } | ForEach-Object { Remove-Item "Env:$($_.Name)" }
$env:APP_VARIANT = 'demo'
$env:EXPO_PUBLIC_DEMO_MODE = '1'
$env:NODE_ENV = 'production'
if ($IncludeKakaoKey) {
  $line = Get-Content (Join-Path $proj '.env') | Where-Object { $_ -match '^EXPO_PUBLIC_KAKAO_JS_KEY=.+' } | Select-Object -First 1
  if (-not $line) { throw '.env 에 EXPO_PUBLIC_KAKAO_JS_KEY 값이 없습니다.' }
  $env:EXPO_PUBLIC_KAKAO_JS_KEY = ($line -replace '^EXPO_PUBLIC_KAKAO_JS_KEY=', '').Trim()
  Write-Host '카카오 JavaScript 키를 포함합니다(클라이언트용 키).'
} else {
  Write-Host '카카오 지도 키는 포함하지 않습니다(예시 검색만 동작).'
}

Push-Location $WorkDir
try {
  Step '3/4 expo prebuild (android 프로젝트 생성) + gradle assembleRelease'
  if ($Incremental -and (Test-Path 'android\gradlew.bat')) {
    Write-Host '기존 android 프로젝트를 재사용합니다(-Incremental).'
  } else {
    Run 'npx' @('expo', 'prebuild', '--platform', 'android', '--clean', '--no-install')

    $sdkDir = $AndroidHome.Replace('\', '/')
    Set-Content -Path 'android\local.properties' -Value "sdk.dir=$sdkDir" -Encoding ascii
    Add-Content -Path 'android\gradle.properties' -Value "`norg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8`nreactNativeArchitectures=$Abis"
  }

  Push-Location android
  try { Run '.\gradlew.bat' @('assembleRelease', '--no-daemon', '--console=plain') } finally { Pop-Location }

  Step '4/4 결과 복사와 점검'
  $built = Get-ChildItem 'android\app\build\outputs\apk\release\*.apk' | Select-Object -First 1
  if (-not $built) { throw 'APK 가 만들어지지 않았습니다.' }
  New-Item -ItemType Directory -Force (Join-Path $proj 'dist') | Out-Null
  $dest = Join-Path $proj 'dist\ReelSpot-Demo.apk'
  Copy-Item $built.FullName $dest -Force
  Write-Host ("APK: {0}  ({1:N1} MB)" -f $dest, ((Get-Item $dest).Length / 1MB))

  $buildTools = Get-ChildItem "$AndroidHome\build-tools" | Sort-Object Name | Select-Object -Last 1
  & "$($buildTools.FullName)\aapt2.exe" dump badging $dest | Select-String -Pattern "^package:|application-label:|native-code:|sdkVersion|targetSdkVersion"
} finally {
  Pop-Location
}
