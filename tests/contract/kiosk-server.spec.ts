import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * kiosk/local-server.ps1 kompileerib C# koodi Windows PowerShell 5.1 `Add-Type`-iga
 * (C# 5, hoiatused = vead). Linuxis ei saa PowerShelli käivitada, kuid sama koodi saab
 * kontrollida staatiliselt ning Mono `mcs`-i ja `mono` olemasolul ka kompileerida ja
 * käivitada. Ilma Monota jäetakse need kaks testi vahele (CI-s tuleks Mono paigaldada).
 */
const script = readFileSync(resolve("kiosk/local-server.ps1"), "utf8");
const csharp = script.slice(script.indexOf("@'\n") + 3, script.indexOf("\n'@"));
const has = (command: string) => spawnSync("which", [command]).status === 0;
const hasMono = has("mcs") && has("mono");
const work = mkdtempSync(join(tmpdir(), "ku-kiosk-server-"));

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("kioski kohalik server (C#)", () => {
  it("ükski async meetod ei viska ootamata ülesannet kõrvale (CS4014 → Add-Type viga)", () => {
    const asyncBodies = [...csharp.matchAll(/\basync\s+Task\b[^{]*\{([\s\S]*?)\n {2}\}/g)].map((m) => m[1]);
    expect(asyncBodies.length).toBeGreaterThan(0);
    for (const body of asyncBodies) expect(body).not.toMatch(/^\s*Task\.(Run|Factory\.StartNew)\(/m);
  });

  it.skipIf(!hasMono)("kompileerub C# 5 reeglitega ilma ühegi hoiatuseta", () => {
    writeFileSync(join(work, "server.cs"), csharp);
    const result = spawnSync(
      "mcs",
      ["-langversion:5", "-warn:4", "-warnaserror+", "-target:library", "-out:server.dll", "server.cs"],
      { cwd: work, encoding: "utf8" },
    );
    expect(`${result.stdout}${result.stderr}`.trim()).toBe("");
    expect(result.status).toBe(0);
  });

  it.skipIf(!hasMono)("vastab /healthz signatuuriga ka siis, kui päring sisaldab päiseid", async () => {
    writeFileSync(join(work, "server.cs"), csharp);
    writeFileSync(
      join(work, "host.cs"),
      `using System.Threading;
public static class Host {
  public static void Main(string[] a) {
    new KuInfoServer(int.Parse(a[0]), a[1], a[2], a[3], "KU-INFOEKRAAN-OK")
      .RunAsync(CancellationToken.None).GetAwaiter().GetResult();
  }
}`,
    );
    const build = spawnSync(
      "mcs",
      ["-langversion:5", "-warnaserror+", "-out:host.exe", "server.cs", "host.cs"],
      {
        cwd: work,
        encoding: "utf8",
      },
    );
    expect(build.status, build.stderr).toBe(0);
    const port = 20_000 + (process.pid % 20_000);
    const server = spawn(
      "mono",
      [join(work, "host.exe"), String(port), work, join(work, "config.js"), join(work, "hb")],
      {
        stdio: "ignore",
      },
    );
    try {
      let body = "";
      for (let attempt = 0; attempt < 50 && body !== "KU-INFOEKRAAN-OK"; attempt += 1) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
            headers: { "X-Long-Header": "x".repeat(2000) },
          });
          expect(response.status).toBe(200);
          body = (await response.text()).trim();
        } catch {
          await new Promise((done) => setTimeout(done, 100));
        }
      }
      expect(body).toBe("KU-INFOEKRAAN-OK");
      const heartbeat = await fetch(`http://127.0.0.1:${port}/heartbeat`, { method: "POST" });
      expect(heartbeat.status).toBe(204);
    } finally {
      server.kill();
    }
  });
});
