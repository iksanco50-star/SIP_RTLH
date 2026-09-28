# Lightweight static HTTP server in PowerShell
$port = 8080
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "SIP-RLTH Web Server aktif di: http://localhost:$port/"
} catch {
    $port = 8888
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Host "SIP-RLTH Web Server aktif di: http://localhost:$port/"
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath) -or $urlPath -eq "/") {
            $urlPath = "index.html"
        }

        # Security check: prevent directory traversal
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $urlPath))
        if (-not $filePath.StartsWith([System.IO.Path]::GetFullPath($root))) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        # CORS headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = "application/octet-stream" }
            $response.ContentType = $mime

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200

            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $response.StatusCode = 404
            if ($request.HttpMethod -ne "HEAD") {
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
                $response.ContentLength64 = $notFound.Length
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
        }
        $response.Close()
    } catch {
        # ignore context aborted exceptions
    }
}
