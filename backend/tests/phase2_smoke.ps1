param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$OutputPath = "$PSScriptRoot\phase2_smoke_output.json"
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$teacherEmail = 'teacher.smoke@test.com'
$studentEmail = 'student.smoke@test.com'
$smokePassword = if ([string]::IsNullOrWhiteSpace([string]$env:PHASE2_SMOKE_PASSWORD)) { 'SmokePass123!' } else { [string]$env:PHASE2_SMOKE_PASSWORD }

function Assert($condition, $message = $null) {
  if ($null -eq $message -and $condition -is [System.Array] -and $condition.Count -ge 2) {
    $conditionArray = $condition
    $condition = [bool]$conditionArray[0]
    $message = [string]$conditionArray[1]
  }

  if ([string]::IsNullOrWhiteSpace([string]$message)) {
    $message = 'Assertion failed'
  }

  if (-not [bool]$condition) {
    throw "Assertion failed: $message"
  }
}

function PostJson($uri, $body, $token) {
  $headers = @{}
  if ($token) {
    $headers['Authorization'] = "Bearer $token"
  }

  $json = $body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 20
}

function GetJson($uri, $token) {
  $headers = @{}
  if ($token) {
    $headers['Authorization'] = "Bearer $token"
  }

  return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20
}

function GetStatusCode($ErrorRecord) {
  if ($null -eq $ErrorRecord -or $null -eq $ErrorRecord.Exception) {
    return 0
  }

  $response = $ErrorRecord.Exception.Response
  if ($null -eq $response) {
    return 0
  }

  if ($response.StatusCode -is [int]) {
    return [int]$response.StatusCode
  }

  if ($null -ne $response.StatusCode.value__) {
    return [int]$response.StatusCode.value__
  }

  return 0
}

function GetErrorBody($ErrorRecord) {
  if ($null -eq $ErrorRecord -or $null -eq $ErrorRecord.ErrorDetails) {
    return $null
  }

  $raw = [string]$ErrorRecord.ErrorDetails.Message
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  try {
    return $raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

Write-Output 'STEP 1: ensure pre-verified smoke users + login teacher/student'
$setupScriptPath = Join-Path $PSScriptRoot '..\scripts\ensure_phase2_smoke_users.js'
$setupOutput = & node $setupScriptPath
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to ensure phase2 smoke users via local setup script'
}
if (-not [string]::IsNullOrWhiteSpace([string]$setupOutput)) {
  Write-Output $setupOutput
}

$teacherLogin = PostJson "$base/api/auth/login" @{
  email = $teacherEmail
  password = $smokePassword
} $null
$studentLogin = PostJson "$base/api/auth/login" @{
  email = $studentEmail
  password = $smokePassword
} $null

$teacherToken = $teacherLogin.data.token
$studentToken = $studentLogin.data.token
Write-Output "DEBUG token lengths teacher=$($teacherToken.Length) student=$($studentToken.Length)"
Assert -condition ([string]::IsNullOrWhiteSpace($teacherToken) -eq $false) -message 'Teacher token should exist after login'
Assert -condition ([string]::IsNullOrWhiteSpace($studentToken) -eq $false) -message 'Student token should exist after login'

Write-Output 'STEP 2: create paid/free lessons'
$lessonA = PostJson "$base/api/lessons" @{
  title = 'Phase2 Paid Lesson A'
  description = 'Paid lesson A for order lifecycle verification'
  price = 120
  fileUrl = 'https://example.com/phase2-a.pdf'
  isPublished = $true
} $teacherToken
$lessonB = PostJson "$base/api/lessons" @{
  title = 'Phase2 Paid Lesson B'
  description = 'Paid lesson B for cancellation verification'
  price = 220
  fileUrl = 'https://example.com/phase2-b.pdf'
  isPublished = $true
} $teacherToken
$lessonC = PostJson "$base/api/lessons" @{
  title = 'Phase2 Free Lesson C'
  description = 'Free lesson C for entitlement verification'
  price = 0
  fileUrl = 'https://example.com/phase2-c.pdf'
  isPublished = $true
} $teacherToken

$lessonAId = [int]$lessonA.data.id
$lessonBId = [int]$lessonB.data.id
$lessonCId = [int]$lessonC.data.id

Write-Output 'STEP 3: entitlement before purchase'
$entBefore = GetJson "$base/api/orders/entitlements/$lessonAId" $studentToken
Assert -condition ($entBefore.data.hasAccess -eq $false) -message 'Entitlement before purchase should be false'
Assert -condition ($entBefore.data.reason -eq 'NOT_PURCHASED') -message 'Entitlement reason before purchase should be NOT_PURCHASED'

Write-Output 'STEP 4: create/list/detail order'
$orderA = PostJson "$base/api/orders" @{ lessonId = $lessonAId } $studentToken
$orderAId = [int]$orderA.data.id
Assert -condition ($orderA.data.status -eq 'pending') -message 'Paid lesson should create pending order'
Assert -condition ([int]$orderA.data.userId -gt 0) -message 'Order response should include userId alias'

$list = GetJson "$base/api/orders" $studentToken
Assert -condition (($list.data | Measure-Object).Count -ge 1) -message 'Order list should include at least one order'

$detail = GetJson "$base/api/orders/$orderAId" $studentToken
Assert -condition ([int]$detail.data.id -eq $orderAId) -message 'Order detail id should match'

Write-Output 'STEP 4B: ownership access error contract'
$forbiddenStatus = 0
$forbiddenBody = $null
try {
  $null = GetJson "$base/api/orders/$orderAId" $teacherToken
  $forbiddenStatus = 200
} catch {
  $forbiddenStatus = GetStatusCode $_
  $forbiddenBody = GetErrorBody $_
}
Assert -condition ($forbiddenStatus -eq 403) -message 'Non-owner order detail should return HTTP 403'
Assert -condition ($null -ne $forbiddenBody -and $forbiddenBody.success -eq $false) -message '403 response should follow error envelope'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$forbiddenBody.message) -eq $false) -message '403 response should include message'

Write-Output 'STEP 5: payment validation + lifecycle failed -> pending -> paid'
$invalidMethodStatus = 0
$invalidMethodBody = $null
try {
  $null = PostJson "$base/api/orders/$orderAId/payment" @{
    status = 'pending'
    method = 'crypto'
    reference = "INVALID-$suffix"
  } $studentToken
  $invalidMethodStatus = 200
} catch {
  $invalidMethodStatus = GetStatusCode $_
  $invalidMethodBody = GetErrorBody $_
}
Assert -condition ($invalidMethodStatus -eq 400) -message 'Invalid payment method should return HTTP 400'
Assert -condition ($null -ne $invalidMethodBody -and $invalidMethodBody.success -eq $false) -message '400 response should follow error envelope'
Assert -condition ($null -ne $invalidMethodBody.errors) -message '400 validation response should include errors field'

$failed = PostJson "$base/api/orders/$orderAId/payment" @{
  status = 'failed'
  method = 'vnpay'
  reference = "FAIL-$suffix"
} $studentToken
Assert -condition ($failed.data.status -eq 'failed') -message 'Order should transition to failed'

$pending = PostJson "$base/api/orders/$orderAId/payment" @{
  status = 'pending'
  method = 'vnpay'
  reference = "PENDING-$suffix"
} $studentToken
Assert -condition ($pending.data.status -eq 'pending') -message 'Order should transition to pending'

$paid = PostJson "$base/api/orders/$orderAId/payment" @{
  status = 'paid'
  method = 'vnpay'
  reference = "PAID-$suffix"
} $studentToken
Assert -condition ($paid.data.status -eq 'paid') -message 'Order should transition to paid'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$paid.data.entitlementGrantedAt) -eq $false) -message 'Paid order should include entitlementGrantedAt'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$paid.data.paymentRef) -eq $false) -message 'Paid order should include paymentRef alias'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$paid.data.paymentReference) -eq $false) -message 'Paid order should include paymentReference transitional alias'
Assert -condition (([string]$paid.data.paymentMethod) -eq 'vnpay') -message 'paymentMethod should be normalized lowercase for frontend compatibility'

Write-Output 'STEP 6: payment-result + entitlement after paid'
$paymentResult = GetJson "$base/api/orders/$orderAId/payment-result" $studentToken
Assert -condition ($paymentResult.data.status -eq 'paid') -message 'Payment result status should be paid'
Assert -condition ($paymentResult.data.accessState -eq 'unlocked') -message 'Access state should be unlocked after paid'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$paymentResult.data.paymentRef) -eq $false) -message 'Payment result should include paymentRef'

$entAfter = GetJson "$base/api/orders/entitlements/$lessonAId" $studentToken
Assert -condition ($entAfter.data.hasAccess -eq $true) -message 'Entitlement after paid should be true'
Assert -condition ($entAfter.data.reason -eq 'PAID_ORDER') -message 'Entitlement reason after paid should be PAID_ORDER'

Write-Output 'STEP 7: pending order cancel flow'
$orderB = PostJson "$base/api/orders" @{ lessonId = $lessonBId } $studentToken
$orderBId = [int]$orderB.data.id
Assert -condition ($orderB.data.status -eq 'pending') -message 'Second paid lesson should create pending order'

$cancelB = PostJson "$base/api/orders/$orderBId/cancel" @{} $studentToken
Assert -condition ($cancelB.data.status -eq 'cancelled') -message 'Pending order cancel should transition to cancelled'

$entB = GetJson "$base/api/orders/entitlements/$lessonBId" $studentToken
Assert -condition ($entB.data.hasAccess -eq $false) -message 'Cancelled order should not grant access'
Assert -condition ($entB.data.reason -eq 'CANCELLED_ORDER') -message 'Cancelled order reason should be CANCELLED_ORDER'

Write-Output 'STEP 8: paid order cancel should return 409 with standard error envelope'
$cancelPaidStatus = 0
$cancelPaidBody = $null
try {
  $null = PostJson "$base/api/orders/$orderAId/cancel" @{} $studentToken
  $cancelPaidStatus = 200
} catch {
  $cancelPaidStatus = GetStatusCode $_
  $cancelPaidBody = GetErrorBody $_
}
Assert -condition ($cancelPaidStatus -eq 409) -message 'Cancelling paid order should return HTTP 409'
Assert -condition ($null -ne $cancelPaidBody -and $cancelPaidBody.success -eq $false) -message '409 response should follow error envelope'
Assert -condition ([string]::IsNullOrWhiteSpace([string]$cancelPaidBody.message) -eq $false) -message '409 response should include message'

Write-Output 'STEP 9: free lesson auto-paid flow'
$orderC = PostJson "$base/api/orders" @{ lessonId = $lessonCId } $studentToken
Assert -condition ($orderC.data.status -eq 'paid') -message 'Free lesson order should auto-set paid'

$entC = GetJson "$base/api/orders/entitlements/$lessonCId" $studentToken
Assert -condition ($entC.data.hasAccess -eq $true) -message 'Free lesson should grant access'
Assert -condition ($entC.data.reason -eq 'FREE_LESSON') -message 'Free lesson reason should be FREE_LESSON'

Write-Output 'STEP 10: save verification output'
$result = [ordered]@{
  baseUrl = $base
  outputPath = $OutputPath
  teacherEmail = $teacherEmail
  studentEmail = $studentEmail
  lessonIds = [ordered]@{
    paidA = $lessonAId
    paidB = $lessonBId
    freeC = $lessonCId
  }
  orderIds = [ordered]@{
    orderA = $orderAId
    orderB = $orderBId
    orderC = [int]$orderC.data.id
  }
  checks = [ordered]@{
    createListDetail = 'ok'
    paymentLifecycle = 'ok'
    cancellation = 'ok'
    entitlement = 'ok'
    contractAliases = 'ok'
    errorContract = 'ok'
  }
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$resultJson = $result | ConvertTo-Json -Depth 8
Set-Content -Path $OutputPath -Value $resultJson -Encoding utf8
Write-Output $resultJson
