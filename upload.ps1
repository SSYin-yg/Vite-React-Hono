# upload.ps1 - Git 自动配置身份、远程仓库、提交与推送脚本

# ===== 请在此处填写你的 GitHub 配置信息 =====
$GithubEmail = "ssyin033@yeah.net"
$GithubName  = "SSYin-yg"
$RepoUrl     = "https://github.com/SSYin-yg/Vite-React-Hono.git"
$BranchName  = "main"
# ===========================================

param (
    [string]$msg = ""
)

# 1. 检查并配置 Git 身份信息
$currentEmail = git config user.email
$currentName  = git config user.name

if ([string]::IsNullOrWhiteSpace($currentEmail)) {
    Write-Host "检测到未配置邮箱，正在配置: $GithubEmail" -ForegroundColor Yellow
    git config --global user.email $GithubEmail
}

if ([string]::IsNullOrWhiteSpace($currentName)) {
    Write-Host "检测到未配置用户名，正在配置: $GithubName" -ForegroundColor Yellow
    git config --global user.name $GithubName
}

# 2. 检查并自动配置远程仓库关联
$remoteUrl = git remote get-url origin 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "检测到未配置远程仓库，正在关联: $RepoUrl" -ForegroundColor Yellow
    git remote add origin $RepoUrl
    git branch -M $BranchName
} elseif ($remoteUrl -ne $RepoUrl) {
    Write-Host "更新远程仓库地址为: $RepoUrl" -ForegroundColor Yellow
    git remote set-url origin $RepoUrl
}

# 3. 获取提交说明
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = Read-Host "请输入本次提交说明 (Commit Message)"
}

if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "Auto update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

# 4. 执行 Git 操作
Write-Host "`n1. 正在添加文件到暂存区..." -ForegroundColor Cyan
git add .

Write-Host "2. 正在提交更改..." -ForegroundColor Cyan
git commit -m "$msg"

Write-Host "3. 正在推送到 GitHub ($RepoUrl)..." -ForegroundColor Cyan
git push -u origin $BranchName

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[Success] 代码已成功推送到 $RepoUrl ！" -ForegroundColor Green
} else {
    Write-Host "`n[Error] 推送失败，请检查上方报错信息。" -ForegroundColor Red
}
Read-Host "按回车键退出..."