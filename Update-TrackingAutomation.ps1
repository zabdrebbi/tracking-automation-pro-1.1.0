param(
    [switch]$Silent
)
$ErrorActionPreference = "Stop"
$Owner = "zabdrebbi"
$Repo = "tracking-automation-pro-1.1.0"
$Branch = "main"
$ExtensionPath = $PSScriptRoot
$StatePath = Join-Path $ExtensionPath ".tracking-automation-pro-last-sha.txt"
$LogPath = Join-Path $ExtensionPath ".tracking-automation-pro-update.log"
$WorkRoot = Join-Path $env:TEMP ("tracking-automation-update-" + [guid]::NewGuid().ToString("N"))
$Transcribing = $false
$ExitCode = 0

if ($Silent) {
    try {
        Start-Transcript -Path $LogPath -Append -Force | Out-Null
        $Transcribing = $true
        Write-Host "بدء الفحص في الخلفية: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    } catch { }
}

try {
    New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null
    $Headers = @{ Accept="application/vnd.github+json"; "User-Agent"="TrackingAutomationPro-Updater"; "X-GitHub-Api-Version"="2022-11-28" }

    Write-Host "أتحقق من GitHub..." -ForegroundColor Cyan
    $Commit = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/commits/$Branch" -Headers $Headers -TimeoutSec 30
    $LatestSha = [string]$Commit.sha
    if ([string]::IsNullOrWhiteSpace($LatestSha)) { throw "لم أستطع قراءة آخر commit." }

    $InstalledSha = ""
    if (Test-Path $StatePath) { $InstalledSha = (Get-Content -Raw $StatePath).Trim() }
    if ($InstalledSha -eq $LatestSha) {
        Write-Host "الإضافة محدّثة بالفعل." -ForegroundColor Green
    }
    else {
        $ZipPath = Join-Path $WorkRoot "source.zip"
        $ExtractPath = Join-Path $WorkRoot "extract"
        New-Item -ItemType Directory -Path $ExtractPath -Force | Out-Null
        Invoke-WebRequest -Uri "https://api.github.com/repos/$Owner/$Repo/zipball/$LatestSha" -Headers $Headers -OutFile $ZipPath -TimeoutSec 120
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force

        $Manifest = Get-ChildItem -Path $ExtractPath -Filter "manifest.json" -File -Recurse | Select-Object -First 1
        if (-not $Manifest) { throw "الملف الذي تم تنزيله لا يحتوي على manifest.json؛ لم يتم تغيير الإضافة." }
        $SourcePath = $Manifest.Directory.FullName
        $ParsedManifest = Get-Content -Raw -LiteralPath $Manifest.FullName | ConvertFrom-Json
        if (-not $ParsedManifest.manifest_version) { throw "manifest.json غير صالح؛ لم يتم تغيير الإضافة." }

        & robocopy $SourcePath $ExtensionPath /MIR /R:2 /W:1 /XD ".git" /XF ".tracking-automation-pro-last-sha.txt" ".tracking-automation-pro-update.log" /NFL /NDL /NJH /NJS
        if ($LASTEXITCODE -ge 8) { throw "فشل نسخ الملفات (robocopy $LASTEXITCODE)." }
        Set-Content -LiteralPath $StatePath -Value $LatestSha -Encoding ASCII

        Write-Host "تم تحديث الملفات إلى commit $($LatestSha.Substring(0,7))." -ForegroundColor Green
        if ($Silent) {
            Write-Host "انتهى التحديث في الخلفية." -ForegroundColor Green
        } else {
            Write-Host "افتح chrome://extensions/ واضغط زر إعادة التحميل (⟳) على بطاقة الإضافة إن لزم." -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "فشل التحديث: $($_.Exception.Message)" -ForegroundColor Red
    $ExitCode = 1
}
finally {
    if ($Transcribing) { try { Stop-Transcript | Out-Null } catch { } }
    if (Test-Path $WorkRoot) { Remove-Item -LiteralPath $WorkRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

if (-not $Silent) {
    Write-Host ""
    [void](Read-Host "اضغط Enter للإغلاق")
}
exit $ExitCode
