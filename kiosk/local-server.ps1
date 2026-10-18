param(
  [int]$Port = 8765,
  [string]$Root = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist'),
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'config.js'),
  [string]$StateRoot = (Join-Path $env:ProgramData 'KuInfoekraan')
)

$ErrorActionPreference = 'Stop'
$signature = 'KU-INFOEKRAAN-OK'
$rootFull = [IO.Path]::GetFullPath($Root)
$configFull = [IO.Path]::GetFullPath($ConfigPath)
$stateFull = [IO.Path]::GetFullPath($StateRoot)
New-Item -ItemType Directory -Path $stateFull -Force | Out-Null
$heartbeat = Join-Path $stateFull 'renderer-heartbeat.txt'

function Test-ExistingKuServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.Trim() -eq $signature
  } catch { return $false }
}

$source = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public sealed class KuInfoServer {
  private readonly int port;
  private readonly string root;
  private readonly string configPath;
  private readonly string heartbeatPath;
  private readonly string signature;
  // Kioskis on üks brauser; piirang hoiab ära, et rippuvad või pahatahtlikud
  // loopback-ühendused tühjendaksid lõimekogumi ja blokeeriksid /healthz-i.
  private readonly SemaphoreSlim connectionGate = new SemaphoreSlim(16, 16);
  private readonly HashSet<string> extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
    ".html", ".css", ".js", ".json", ".png", ".svg", ".ico", ".webmanifest"
  };
  private readonly Dictionary<string,string> mime = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
    { ".html", "text/html; charset=utf-8" }, { ".css", "text/css; charset=utf-8" },
    { ".js", "application/javascript; charset=utf-8" }, { ".json", "application/json; charset=utf-8" },
    { ".png", "image/png" }, { ".svg", "image/svg+xml" }, { ".ico", "image/x-icon" },
    { ".webmanifest", "application/manifest+json; charset=utf-8" }
  };

  public KuInfoServer(int port, string root, string configPath, string heartbeatPath, string signature) {
    this.port = port;
    this.root = EnsureSeparator(Path.GetFullPath(root));
    this.configPath = Path.GetFullPath(configPath);
    this.heartbeatPath = Path.GetFullPath(heartbeatPath);
    this.signature = signature;
  }

  private static string EnsureSeparator(string value) {
    return value.EndsWith(Path.DirectorySeparatorChar.ToString()) ? value : value + Path.DirectorySeparatorChar;
  }

  public async Task RunAsync(CancellationToken token) {
    var listener = new TcpListener(IPAddress.Loopback, port);
    listener.Start();
    try {
      while (!token.IsCancellationRequested) {
        await connectionGate.WaitAsync(token).ConfigureAwait(false);
        TcpClient client;
        try { client = await listener.AcceptTcpClientAsync().ConfigureAwait(false); }
        catch { connectionGate.Release(); throw; }
        Task.Run(() => {
          try { Handle(client); }
          catch { }
          finally { connectionGate.Release(); }
        });
      }
    } finally { listener.Stop(); }
  }

  private void Handle(TcpClient client) {
    using (client) {
      client.ReceiveTimeout = 5000;
      client.SendTimeout = 5000;
      using (var stream = client.GetStream())
      using (var reader = new StreamReader(stream, Encoding.ASCII, false, 4096, true)) {
        string requestLine;
        try { requestLine = reader.ReadLine(); } catch { return; }
        if (String.IsNullOrWhiteSpace(requestLine)) return;
        var parts = requestLine.Split(' ');
        var method = parts.Length > 0 ? parts[0].ToUpperInvariant() : "GET";
        var target = parts.Length > 1 ? parts[1] : "/";
        var path = target.Split('?')[0];

        // Päised loetakse enne igat vastust, ka /healthz puhul. Lugemata andmetega
        // sokli sulgemine saadab Windowsis TCP RST-i ja klient näeb vastuse asemel
        // "connection reset" viga, mis võib watchdogi asjatult käivitada.
        try {
          while (!String.IsNullOrEmpty(reader.ReadLine())) { }
        } catch { }

        if (path == "/healthz") {
          Write(stream, method, "200 OK", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes(signature));
          return;
        }

        if (path == "/heartbeat") {
          if (method != "POST") { Write(stream, method, "405 Method Not Allowed", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("405")); return; }
          try { File.WriteAllText(heartbeatPath, DateTime.UtcNow.ToString("O")); }
          catch { Write(stream, method, "500 Internal Server Error", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("500")); return; }
          Write(stream, method, "204 No Content", "text/plain; charset=utf-8", new byte[0]);
          return;
        }
        if (method != "GET" && method != "HEAD") {
          Write(stream, method, "405 Method Not Allowed", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("405"));
          return;
        }

        string candidate = null;
        try {
          var decoded = Uri.UnescapeDataString(path.TrimStart('/'));
          if (String.IsNullOrWhiteSpace(decoded)) decoded = "index.html";
          candidate = decoded.Equals("config.js", StringComparison.OrdinalIgnoreCase)
            ? configPath
            : Path.GetFullPath(Path.Combine(root, decoded.Replace('/', Path.DirectorySeparatorChar)));
        } catch { }
        if (candidate == null || (!candidate.Equals(configPath, StringComparison.OrdinalIgnoreCase) && !candidate.StartsWith(root, StringComparison.OrdinalIgnoreCase))) {
          Write(stream, method, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("404")); return;
        }
        var ext = Path.GetExtension(candidate);
        if (!extensions.Contains(ext) || !File.Exists(candidate)) {
          Write(stream, method, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("404")); return;
        }
        byte[] bytes;
        try { bytes = File.ReadAllBytes(candidate); }
        catch { Write(stream, method, "500 Internal Server Error", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("500")); return; }
        Write(stream, method, "200 OK", mime.ContainsKey(ext) ? mime[ext] : "application/octet-stream", bytes);
      }
    }
  }

  private static void Write(NetworkStream stream, string method, string status, string contentType, byte[] bytes) {
    const string csp = "default-src 'self'; script-src 'self' https://script.google.com https://script.googleusercontent.com; connect-src 'self' https://script.google.com https://script.googleusercontent.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
    var header = "HTTP/1.1 " + status + "\r\nContent-Type: " + contentType + "\r\nContent-Length: " + bytes.Length +
      "\r\nCache-Control: no-store, no-cache, must-revalidate\r\nPragma: no-cache\r\nX-Content-Type-Options: nosniff" +
      "\r\nContent-Security-Policy: " + csp + "\r\nReferrer-Policy: no-referrer\r\nX-Frame-Options: DENY\r\nConnection: close\r\n\r\n";
    var headers = Encoding.ASCII.GetBytes(header);
    stream.Write(headers, 0, headers.Length);
    if (method != "HEAD" && bytes.Length > 0) stream.Write(bytes, 0, bytes.Length);
    stream.Flush();
  }
}
'@

if (-not ('KuInfoServer' -as [type])) { Add-Type -TypeDefinition $source -Language CSharp }
try {
  $server = [KuInfoServer]::new($Port, $rootFull, $configFull, $heartbeat, $signature)
  $server.RunAsync([Threading.CancellationToken]::None).GetAwaiter().GetResult()
} catch {
  if (Test-ExistingKuServer) { exit 0 }
  Write-Error "Port $Port on hõivatud või server ei käivitunud: $($_.Exception.Message)"
  exit 2
}
