using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

internal static class Launcher
{
    private const string AppUrl = "http://127.0.0.1:4173/";
    private const string HealthResponse = "{\"app\":\"bootcamp-studying-tool\"}";

    [STAThread]
    private static int Main(string[] args)
    {
        bool background = Array.IndexOf(args, "--background") >= 0;
        try
        {
            using (var startLock = new Mutex(false, @"Local\BootcampStudyingTool.Start"))
            {
                // Signing in and opening the launcher can happen at the same time.
                bool locked;
                try { locked = startLock.WaitOne(TimeSpan.FromSeconds(15)); }
                catch (AbandonedMutexException) { locked = true; }
                if (!locked) throw new InvalidOperationException("앱이 시작되는 중입니다. 잠시 후 다시 열어 주세요.");
                try { StartServer(); }
                finally { startLock.ReleaseMutex(); }
            }

            if (!background) Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
            return 0;
        }
        catch (Exception error)
        {
            if (!background) MessageBox.Show(error.Message, "Bootcamp Studying Tool", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }

    private static void StartServer()
    {
        if (IsReady()) return;

        var runtimeDirectory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
        var settings = new ProcessStartInfo(Path.Combine(runtimeDirectory.FullName, "node.exe"), "server.mjs")
        {
            WorkingDirectory = runtimeDirectory.Parent.FullName,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        settings.EnvironmentVariables["PORT"] = "4173";
        using (var server = Process.Start(settings))
        {
            var elapsed = Stopwatch.StartNew();
            while (elapsed.Elapsed < TimeSpan.FromSeconds(10))
            {
                if (IsReady()) return;
                if (server.HasExited) break;
                Thread.Sleep(200);
            }
        }
        throw new InvalidOperationException("로컬 서버를 시작하지 못했습니다. 4173 포트를 사용하는 앱이 있는지 확인해 주세요.");
    }

    private static bool IsReady()
    {
        try
        {
            // Ignore system proxies for the loopback health check.
            var request = (HttpWebRequest)WebRequest.Create(AppUrl + "api/health");
            request.Proxy = null;
            request.Timeout = 700;
            request.ReadWriteTimeout = 700;
            using (var response = request.GetResponse())
            using (var input = new StreamReader(response.GetResponseStream()))
                return input.ReadToEnd() == HealthResponse;
        }
        catch (WebException) { return false; }
    }
}
