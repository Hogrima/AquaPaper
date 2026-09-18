using System.Text.Json;
using Microsoft.Win32;

namespace AquaPaper;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        using var mutex = new Mutex(true, "Local\\AquaPaper-v1", out bool first);
        if (!first) { MessageBox.Show("AquaPaper가 이미 실행 중입니다. 작업 표시줄의 알림 영역에서 물고기 아이콘을 더블 클릭하세요.", "AquaPaper"); return; }
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => { AppLog.Write(e.Exception.ToString()); MessageBox.Show(e.Exception.Message, "AquaPaper"); };
        using var app = new AquariumApp(args);
        Application.Run(app);
    }
}

internal static class AppLog
{
    internal static readonly string DataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AquaPaper");
    internal static void Write(string text)
    {
        try { Directory.CreateDirectory(DataPath); var path = Path.Combine(DataPath, "app.log"); if (File.Exists(path) && new FileInfo(path).Length > 2_000_000) File.WriteAllText(path, ""); File.AppendAllText(path, $"{DateTime.Now:O} {text}{Environment.NewLine}"); } catch { }
    }
}
