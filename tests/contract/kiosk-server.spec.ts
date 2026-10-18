import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * kiosk/local-server.ps1 kompileerib C# koodi Windows PowerShell 5.1 `Add-Type`-iga
 * (C# 5, hoiatused = vead). Linuxis ei saa PowerShelli käivitada, kuid sama koodi saab
 * kontrollida staatiliselt ning Mono `mcs`-i ja `mono` olemasolul ka kompileerida ja
 * käivitada. Ilma Monota jäetakse need testid vahele (CI-s tuleks Mono paigaldada).
 *
 * Windowsi TCP RST-i (lugemata päistega sokli sulgemine) Linuxis ei teki, seega
 * kontrollitakse käitumist, mis selle ära hoiab: server loeb päised enne vastamist.
 */
const script = readFileSync(resolve("kiosk/local-server.ps1"), "utf8");
const csharp = script.slice(script.indexOf("@'\n") + 3, script.indexOf("\n'@"));
const has = (command: string) => spawnSync("which", [command]).status === 0;
const hasMono = has("mcs") && has("mono");
const SIGNATURE = "KU-INFOEKRAAN-OK";

describe("kioski kohalik server (C#), staatiline", () => {
  it("ükski async meetod ei viska ootamata ülesannet kõrvale (CS4014 → Add-Type viga)", () => {
    const asyncBodies = [...csharp.matchAll(/\basync\s+Task\b[^{]*\{([\s\S]*?)\n {2}\}/g)].map((m) => m[1]);
    expect(asyncBodies.length).toBeGreaterThan(0);
    for (const body of asyncBodies) expect(body).not.toMatch(/^\s*Task\.(Run|Factory\.StartNew)\(/m);
  });
});

describe.skipIf(!hasMono)("kioski kohalik server (C#), Mono", () => {
  const work = mkdtempSync(join(tmpdir(), "ku-kiosk-server-"));
  let server: ChildProcess | null = null;
  let port = 0;
  let exited: string | null = null;
  const stop = () => {
    if (server && server.exitCode === null) server.kill("SIGKILL");
  };
  process.once("exit", stop);

  beforeAll(async () => {
    writeFileSync(join(work, "server.cs"), csharp);
    writeFileSync(
      join(work, "host.cs"),
      `using System.Threading;
public static class Host {
  public static void Main(string[] a) {
    new KuInfoServer(int.Parse(a[0]), a[1], a[2], a[3], "${SIGNATURE}")
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
    if (build.status !== 0) throw new Error(`mcs: ${build.stdout}${build.stderr}`);
    // Vaba port küsitakse operatsioonisüsteemilt, mitte ei tuletata protsessi ID-st.
    port = await new Promise<number>((done) => {
      const probe = net.createServer().listen(0, "127.0.0.1", () => {
        const address = probe.address();
        probe.close(() => done(typeof address === "object" && address ? address.port : 0));
      });
    });
    server = spawn(
      "mono",
      [join(work, "host.exe"), String(port), work, join(work, "config.js"), join(work, "hb")],
      { stdio: "ignore" },
    );
    server.on("exit", (code, signal) => {
      exited = `mono lõpetas: code=${code} signal=${signal}`;
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (exited) throw new Error(exited);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
          signal: AbortSignal.timeout(500),
        });
        if ((await response.text()).trim() === SIGNATURE) return;
      } catch {
        // server alles käivitub
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error("Mono server ei vastanud 5 s jooksul");
  }, 30_000);

  afterAll(() => {
    stop();
    rmSync(work, { recursive: true, force: true });
  });

  it("kompileerub C# 5 reeglitega ilma ühegi hoiatuseta", () => {
    const result = spawnSync(
      "mcs",
      ["-langversion:5", "-warn:4", "-warnaserror+", "-target:library", "-out:server.dll", "server.cs"],
      { cwd: work, encoding: "utf8" },
    );
    expect(`${result.stdout}${result.stderr}`.trim()).toBe("");
    expect(result.status).toBe(0);
  });

  it("vastab /healthz signatuuriga watchdogi 2 s piiri sees ka pika päisega", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
      headers: { "X-Long-Header": "x".repeat(6000) },
      signal: AbortSignal.timeout(2000),
    });
    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe(SIGNATURE);
  });

  it("loeb päised enne /healthz vastust (lugemata päised põhjustaksid Windowsis RST-i)", async () => {
    const result = await new Promise<{ early: string; body: string }>((done, fail) => {
      const socket = net.connect(port, "127.0.0.1");
      let received = "";
      let early = "";
      let terminatorSent = false;
      socket.setTimeout(3000, () => fail(new Error("vastust ei tulnud")));
      socket.on("error", fail);
      socket.on("data", (chunk) => {
        received += chunk;
        if (!terminatorSent) early += chunk;
      });
      socket.on("close", () => done({ early, body: received }));
      // Päised on saadetud, kuid lõpetav tühi rida veel mitte: server ei tohi vastata.
      socket.write("GET /healthz HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Probe: 1\r\n");
      setTimeout(() => {
        terminatorSent = true;
        if (!socket.destroyed) socket.write("\r\n");
      }, 400);
    });
    expect(result.early).toBe("");
    expect(result.body).toContain("200 OK");
    expect(result.body).toContain(SIGNATURE);
  });

  it("võtab vastu POST /heartbeat", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/heartbeat`, {
      method: "POST",
      signal: AbortSignal.timeout(2000),
    });
    expect(response.status).toBe(204);
  });
});
