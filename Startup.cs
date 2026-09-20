namespace AquaPaper;

internal sealed partial class AquariumApp
{
    private readonly StartupRegistration startupRegistration = new(Path.Combine(AppContext.BaseDirectory, "AquaPaper.exe"));
    private readonly System.Windows.Forms.Timer startupTimer = new() { Interval = 1500 };
    private readonly Control dispatcher = new();
    private bool startupLaunching;
    private int startupAttempts;

    internal void BroadcastStartup(string? error = null)
    {
        try {
            var command = startupRegistration.Read();
            bool enabled = command == StartupRegistration.Command(Path.Combine(AppContext.BaseDirectory, "AquaPaper.exe"));
            if (command != null && !enabled) error ??= T("다른 폴더의 AquaPaper가 자동 실행으로 등록되어 있습니다. 이 옵션을 켜면 현재 폴더로 변경됩니다.", "Another AquaPaper folder is registered for startup. Turn this option on to use the current folder.");
            if (enabled && StartupRegistration.DisabledByWindows()) error ??= T("Windows에서 자동 시작을 차단했습니다. 작업 관리자 → 시작 앱에서 AquaPaper를 사용으로 설정하세요.", "Windows has disabled startup. Enable AquaPaper in Task Manager → Startup apps.");
            preview?.Post(new { type = "startup", enabled, available = !Testing, error });
        }
        catch (Exception e) { AppLog.Write(e.ToString()); preview?.Post(new { type = "startup", enabled = false, available = false, error = T("Windows 자동 시작 설정을 읽지 못했습니다.", "Could not read Windows startup preferences.") }); }
    }
    internal void ChangeStartup(bool enabled)
    {
        if (Testing) { BroadcastStartup(); return; }
        try { startupRegistration.Set(enabled); BroadcastStartup(); }
        catch (Exception e) { AppLog.Write(e.ToString()); BroadcastStartup(T("자동 시작 설정을 저장하지 못했습니다. Windows 권한을 확인해 주세요.", "Could not save startup preferences. Check Windows permissions.")); }
    }
    private void InitializeStartup()
    {
        _ = dispatcher.Handle; // UI dispatcher also works when no preview has ever been opened.
        startupTimer.Tick += async (_, _) => {
            startupTimer.Stop();
            if (closing) return;
            startupLaunching = true; startupAttempts++;
            try { await ApplyWallpaper(); }
            finally { startupLaunching = false; }
            if (closing) return;
            if (wallpaperWanted && wallpapers.Count > 0) {
                if (args.Contains("--startup-smoke-test")) await RunStartupSmokeTest();
                return;
            }
            // Explorer/WebView2 may still be starting at sign-in. Retry without flashing a window.
            if (startupAttempts < 6) { startupTimer.Interval = 4000; startupTimer.Start(); }
            else if (args.Contains("--startup-smoke-test")) await RunStartupSmokeTest();
            else {
                ShowPreview(true);
                preview?.Post(new { type = "toast", text = T("자동 적용에 실패했습니다. 바탕화면에 적용을 다시 눌러 주세요.", "Automatic application failed. Try Apply wallpaper again.") });
            }
        };
        if (args.Contains("--startup")) { startupHandled = true; startupTimer.Start(); }
        else ShowPreview(args.Contains("--settings"));
    }
}
