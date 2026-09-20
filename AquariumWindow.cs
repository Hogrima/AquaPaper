using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AquaPaper;

internal sealed class AquariumWindow : Form
{
    private readonly AquariumApp app;
    private readonly WebView2 web;
    private readonly System.Windows.Forms.Timer cursorTimer;
    private readonly TaskCompletionSource initialized = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private bool ready, fullScreen, showSettingsPending;
    private Rectangle previousBounds;
    private NativeMethods.POINT previousCursor;
    private long previousCursorTime;
    internal bool IsWallpaper { get; }
    internal WallpaperTarget? Target { get; }
    internal bool? LastSuspended;
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    internal bool PollCursor { get; set; } = true;
    internal nint DesktopParent { get; private set; }
    internal Task Initialized => initialized.Task;
    protected override bool ShowWithoutActivation => IsWallpaper;

    internal AquariumWindow(AquariumApp app, bool wallpaper, WallpaperTarget? target = null)
    {
        this.app = app; IsWallpaper = wallpaper; Target = target;
        Text = app.WindowTitle;
        BackColor = Color.FromArgb(8, 26, 20);
        AutoScaleMode = wallpaper ? AutoScaleMode.None : AutoScaleMode.Dpi;
        if (wallpaper) { FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; StartPosition = FormStartPosition.Manual; }
        else { ClientSize = new Size(1280, 760); MinimumSize = new Size(650, 460); StartPosition = FormStartPosition.CenterScreen; }
        web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
        Controls.Add(web);
        cursorTimer = new System.Windows.Forms.Timer { Interval = 33 };
        cursorTimer.Tick += (_, _) => UpdateCursor();
        if (wallpaper) cursorTimer.Start();
        Shown += async (_, _) => await InitializeWeb();
        FormClosing += (_, e) => { if (!IsWallpaper && !app.IsClosing && !app.ClosePreview()) e.Cancel = true; };
        Resize += (_, _) => { if (!IsWallpaper) Post(new { type = "suspend", paused = WindowState == FormWindowState.Minimized || !Visible }); };
    }

    private async Task InitializeWeb()
    {
        try {
            var options = new CoreWebView2EnvironmentOptions("--disable-background-timer-throttling --disable-renderer-backgrounding --autoplay-policy=no-user-gesture-required");
            var env = await CoreWebView2Environment.CreateAsync(null, app.WebViewDataPath, options);
            await web.EnsureCoreWebView2Async(env);
            var core = web.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("aquapaper.local", Path.Combine(AppContext.BaseDirectory, "web"), CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.IsPinchZoomEnabled = false;
            core.NavigationStarting += (_, e) => { if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "aquapaper.local") e.Cancel = true; };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.WebMessageReceived += async (_, e) => await Message(e);
            core.ProcessFailed += (_, e) => { AppLog.Write($"WebView2 failed: {e.ProcessFailedKind}"); if (!IsDisposed && !Disposing) { ready = false; core.Reload(); } };
            core.Navigate("https://aquapaper.local/index.html");
        }
        catch (Exception e) {
            AppLog.Write(e.ToString()); initialized.TrySetException(e);
            if (!IsWallpaper) MessageBox.Show(this, "수족관을 시작하지 못했습니다. Microsoft Edge WebView2 Runtime이 설치되어 있는지 확인해 주세요.\n\n" + e.Message, "AquaPaper", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task Message(CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith("https://aquapaper.local/", StringComparison.Ordinal)) return;
        try {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson); var m = doc.RootElement;
            switch (m.GetProperty("type").GetString()) {
                case "ready": ready = true; initialized.TrySetResult(); await app.OnReady(this); if (showSettingsPending) { Post(new { type = "showSettings" }); showSettingsPending = false; } break;
                case "settings": app.SaveSettings(m.GetProperty("settings")); break;
                case "display": if (!IsWallpaper) await app.ChangeDisplay(m.GetProperty("options")); break;
                case "startup": if (!IsWallpaper) app.ChangeStartup(m.GetProperty("enabled").GetBoolean()); break;
                case "startupRefresh": if (!IsWallpaper) app.BroadcastStartup(); break;
                case "displayRefresh": if (!IsWallpaper) app.BroadcastDisplays(); break;
                case "wallpaper": if (!IsWallpaper) await app.ApplyWallpaper(); break;
                case "pause": app.SetPaused(m.GetProperty("paused").GetBoolean()); break;
                case "fullscreen": if (!IsWallpaper) ToggleFullscreen(); break;
                case "error": var error = m.GetProperty("message").GetString() ?? "Unknown renderer error"; AppLog.Write(error); initialized.TrySetException(new InvalidOperationException(error)); break;
            }
        }
        catch (Exception error) { AppLog.Write(error.ToString()); }
    }

    internal void Post(object value) { if (ready && !IsDisposed && web.CoreWebView2 != null) { try { web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(value)); } catch (Exception e) { AppLog.Write(e.Message); } } }
    internal void OpenSettings() { if (ready) Post(new { type = "showSettings" }); else showSettingsPending = true; }
    internal void AttachToDesktop() { DesktopParent = NativeMethods.AttachDesktop(Handle, Target!.Bounds); }
    internal Task<string> Diagnostics() => web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.aquariumDiagnostics())").ContinueWith(t => JsonSerializer.Deserialize<string>(t.GetAwaiter().GetResult()) ?? "null", TaskScheduler.Default);
    internal async Task CaptureFrame(string path) { using var stream = File.Create(path); await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream); }

    private void ToggleFullscreen()
    {
        if (!fullScreen) { previousBounds = Bounds; WindowState = FormWindowState.Normal; FormBorderStyle = FormBorderStyle.None; Bounds = Screen.FromControl(this).Bounds; }
        else { FormBorderStyle = FormBorderStyle.Sizable; Bounds = previousBounds; }
        fullScreen = !fullScreen; Post(new { type = "fullscreen", active = fullScreen });
    }
    private void UpdateCursor()
    {
        if (!ready || !PollCursor || IsDisposed || Target == null || !NativeMethods.GetCursorPos(out var screen)) return;
        var point = new Point(screen.X, screen.Y);
        var mapped = Target.NormalizeCursor(point);
        bool active = mapped.Active && NativeMethods.IsDesktopUnderCursor(screen, Handle);
        int height = Math.Max(1, Target.Bounds.Height);
        var now = Environment.TickCount64;
        var speed = previousCursorTime == 0 ? 0 : Math.Sqrt(Math.Pow(screen.X - previousCursor.X, 2) + Math.Pow(screen.Y - previousCursor.Y, 2)) / height / Math.Max(.01, (now - previousCursorTime) / 1000.0);
        previousCursor = screen; previousCursorTime = now;
        Post(new { type = "cursor", x = mapped.X, y = mapped.Y, active, speed = Math.Min(4, speed) });
    }
    protected override void OnDpiChanged(DpiChangedEventArgs e)
    {
        // Wallpaper geometry comes from physical desktop bounds, not the monitor's UI scale.
        if (IsWallpaper) e.Cancel = true;
        base.OnDpiChanged(e);
    }
    protected override void WndProc(ref System.Windows.Forms.Message m)
    {
        if (IsWallpaper && m.Msg == 0x0084) { m.Result = -1; return; } // HTTRANSPARENT: icons retain normal mouse behavior.
        if (IsWallpaper && m.Msg == 0x0021) { m.Result = 3; return; } // MA_NOACTIVATE.
        base.WndProc(ref m);
    }
    protected override void Dispose(bool disposing) { if (disposing) { initialized.TrySetCanceled(); cursorTimer.Stop(); cursorTimer.Dispose(); web.Dispose(); } base.Dispose(disposing); }
}
