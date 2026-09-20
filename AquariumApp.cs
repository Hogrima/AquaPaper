using System.Text.Json;
using Microsoft.Win32;

namespace AquaPaper;

internal sealed partial class AquariumApp : ApplicationContext
{
    private readonly NotifyIcon tray;
    private readonly Icon icon;
    private readonly ToolStripMenuItem openItem, settingsItem, applyItem, pauseItem, stopItem, layoutsItem, exitItem;
    private readonly System.Windows.Forms.Timer healthTimer, displayTimer;
    private readonly SemaphoreSlim layoutGate = new(1, 1);
    private readonly List<AquariumWindow> wallpapers = [];
    private AquariumWindow? preview;
    private JsonElement settings;
    private DisplayOptions display = new();
    private bool paused, closing, sessionLocked, powerSuspended, wallpaperWanted, layoutBusy, startupHandled;
    private int layoutRevision;
    private readonly string[] args;
    private bool Testing => args.Contains("--smoke-test") || args.Contains("--multi-smoke-test") || args.Contains("--startup-smoke-test");
    internal bool IsClosing => closing;
    internal string WindowTitle => T("AquaPaper · 살아 있는 수족관", "AquaPaper · Living Aquarium");
    internal string WebViewDataPath => Path.Combine(AppLog.DataPath, Testing ? "WebView2-Test" : "WebView2");
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true, WriteIndented = true };

    internal AquariumApp(string[] args)
    {
        this.args = args;
        Directory.CreateDirectory(AppLog.DataPath);
        settings = JsonSerializer.SerializeToElement(new { count = 72, activity = 65, lighting = "day", interaction = true, particles = true, quality = "balanced", fishMode = "tetra3d", language = "ko" });
        try { using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppLog.DataPath, "settings.json"))); if (doc.RootElement.ValueKind == JsonValueKind.Object) settings = NormalizeSettings(doc.RootElement); } catch { }
        try { display = (JsonSerializer.Deserialize<DisplayOptions>(File.ReadAllText(Path.Combine(AppLog.DataPath, "display-settings.json")), JsonOptions) ?? new()).Validated(); } catch { }
        if (Testing && !args.Contains("--startup-smoke-test")) settings = JsonSerializer.SerializeToElement(new { count = 72, activity = 65, lighting = "day", interaction = true, particles = true, quality = "balanced", fishMode = "tetra3d", language = "ko" });
        icon = CreateIcon();
        var menu = new ContextMenuStrip();
        openItem = (ToolStripMenuItem)menu.Items.Add("수족관 열기", null, (_, _) => ShowPreview());
        settingsItem = (ToolStripMenuItem)menu.Items.Add("환경 설정", null, (_, _) => ShowPreview(true));
        menu.Items.Add(new ToolStripSeparator());
        applyItem = (ToolStripMenuItem)menu.Items.Add("바탕화면에 적용", null, async (_, _) => await ApplyWallpaper());
        stopItem = (ToolStripMenuItem)menu.Items.Add("바탕화면 해제", null, (_, _) => StopWallpaper()); stopItem.Enabled = false;
        layoutsItem = new ToolStripMenuItem("모니터 배치");
        layoutsItem.DropDownOpening += (_, _) => BuildDisplayMenu(layoutsItem); menu.Items.Add(layoutsItem);
        pauseItem = (ToolStripMenuItem)menu.Items.Add("일시정지", null, (_, _) => SetPaused(!paused));
        menu.Items.Add(new ToolStripSeparator()); exitItem = (ToolStripMenuItem)menu.Items.Add("AquaPaper 종료", null, (_, _) => ExitThread());
        tray = new NotifyIcon { Icon = icon, Text = WindowTitle, Visible = true, ContextMenuStrip = menu };
        UpdateTrayLanguage();
        tray.DoubleClick += (_, _) => ShowPreview();
        healthTimer = new System.Windows.Forms.Timer { Interval = 1000 };
        healthTimer.Tick += (_, _) => CheckHealth(); healthTimer.Start();
        displayTimer = new System.Windows.Forms.Timer { Interval = 900 };
        displayTimer.Tick += async (_, _) => { displayTimer.Stop(); BroadcastDisplays(); if (wallpaperWanted) await RebuildWallpapers(false); };
        SystemEvents.DisplaySettingsChanged += DisplayChanged; SystemEvents.SessionSwitch += SessionChanged; SystemEvents.PowerModeChanged += PowerChanged;
        InitializeStartup();
    }

    internal static IReadOnlyList<MonitorInfo> Monitors() => Screen.AllScreens.Select((s, i) => {
        var digits = new string(s.DeviceName.Reverse().TakeWhile(char.IsDigit).Reverse().ToArray());
        return new MonitorInfo(s.DeviceName, int.TryParse(digits, out int n) ? n : i + 1, s.Primary, s.Bounds);
    }).OrderBy(m => m.Number).ToArray();

    private void BuildDisplayMenu(ToolStripMenuItem menu)
    {
        foreach (ToolStripItem old in menu.DropDownItems.Cast<ToolStripItem>().ToArray()) old.Dispose();
        menu.DropDownItems.Clear();
        var one = new ToolStripMenuItem(T("한 화면만", "One display")) { Checked = display.Mode == "single" };
        var monitors = Monitors(); var effective = WallpaperLayout.Build(display with { Mode = "single" }, monitors)[0].Key;
        foreach (var m in monitors) {
            var item = new ToolStripMenuItem(MonitorLabel(m)) { Checked = display.Mode == "single" && m.Id == effective };
            item.Click += async (_, _) => await SetDisplay(new("single", m.Id)); one.DropDownItems.Add(item);
        }
        menu.DropDownItems.Add(one);
        foreach (var pair in new[] { ("span", T("모두 이어서 · 하나의 넓은 수족관", "Span all · one wide aquarium")), ("separate", T("화면마다 따로 · 각각의 수족관", "Separate · one aquarium per display")) }) {
            var item = new ToolStripMenuItem(pair.Item2) { Checked = display.Mode == pair.Item1 };
            item.Click += async (_, _) => await SetDisplay(display with { Mode = pair.Item1 }); menu.DropDownItems.Add(item);
        }
        menu.DropDownItems.Add(new ToolStripSeparator()); menu.DropDownItems.Add(T("배치도와 설정 열기", "Open layout and settings"), null, (_, _) => ShowPreview(true));
    }
    private object DisplayMessage()
    {
        var monitors = Monitors(); var single = WallpaperLayout.Build(display with { Mode = "single" }, monitors)[0];
        return new {
            type = "displays", mode = display.Mode, monitorId = display.MonitorId ?? single.Key,
            effectiveMonitorId = single.Key, active = wallpaperWanted && wallpapers.Count > 0 && !layoutBusy, busy = layoutBusy,
            monitors = monitors.Select(m => new { id = m.Id, number = m.Number, primary = m.Primary, x = m.Bounds.X, y = m.Bounds.Y, width = m.Bounds.Width, height = m.Bounds.Height })
        };
    }
    internal void BroadcastDisplays() { if (!closing) preview?.Post(DisplayMessage()); }
    internal Task ChangeDisplay(JsonElement value)
    {
        var requested = JsonSerializer.Deserialize<DisplayOptions>(value.GetRawText(), JsonOptions);
        if (requested == null || requested.Mode is not ("single" or "span" or "separate")) return Task.CompletedTask;
        return SetDisplay(requested);
    }
    private async Task SetDisplay(DisplayOptions value)
    {
        display = value.Validated();
        if (!Testing) SaveJson("display-settings.json", JsonSerializer.Serialize(display, JsonOptions));
        BroadcastDisplays(); if (wallpaperWanted) await RebuildWallpapers(false);
    }
    private void SaveJson(string file, string json)
    {
        try { var path = Path.Combine(AppLog.DataPath, file); File.WriteAllText(path + ".tmp", json); File.Move(path + ".tmp", path, true); }
        catch (Exception e) { AppLog.Write(e.Message); preview?.Post(new { type = "toast", text = T("설정을 저장하지 못했습니다. 폴더 쓰기 권한을 확인해 주세요.", "Could not save settings. Check that the folder is writable.") }); }
    }
    private static JsonElement NormalizeSettings(JsonElement value)
    {
        var fields = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        if (value.ValueKind == JsonValueKind.Object) foreach (var property in value.EnumerateObject()) fields[property.Name] = property.Value.Clone();
        if (!fields.ContainsKey("fishMode")) fields["fishMode"] = JsonSerializer.SerializeToElement("tetra3d");
        if (!fields.ContainsKey("language")) fields["language"] = JsonSerializer.SerializeToElement("ko");
        int plecos = 0;
        if (fields.TryGetValue("plecoCount", out var valueCount) && valueCount.ValueKind == JsonValueKind.Number && valueCount.TryGetDouble(out var number) && double.IsFinite(number))
            plecos = (int)Math.Clamp(Math.Floor(number + .5), 0, 8);
        fields["plecoCount"] = JsonSerializer.SerializeToElement(plecos);
        return JsonSerializer.SerializeToElement(fields, JsonOptions);
    }
    private bool IsEnglish => settings.ValueKind == JsonValueKind.Object && settings.TryGetProperty("language", out var language) && language.ValueKind == JsonValueKind.String && language.GetString() == "en";
    private string T(string korean, string english) => IsEnglish ? english : korean;
    private string MonitorLabel(MonitorInfo monitor) => IsEnglish
        ? $"Display {monitor.Number} · {monitor.Bounds.Width} × {monitor.Bounds.Height}{(monitor.Primary ? " (primary)" : "")}"
        : monitor.Label;
    private void UpdateTrayLanguage()
    {
        openItem.Text = T("수족관 열기", "Open aquarium");
        settingsItem.Text = T("환경 설정", "Settings");
        applyItem.Text = T("바탕화면에 적용", "Apply wallpaper");
        stopItem.Text = T("바탕화면 해제", "Stop wallpaper");
        layoutsItem.Text = T("모니터 배치", "Monitor layout");
        pauseItem.Text = paused ? T("재생", "Resume") : T("일시정지", "Pause");
        exitItem.Text = T("AquaPaper 종료", "Exit AquaPaper");
        tray.Text = WindowTitle;
    }
    internal static Icon CreateIcon()
    {
        using var b = new Bitmap(32, 32); using var g = Graphics.FromImage(b);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using var bg = new SolidBrush(Color.FromArgb(19, 43, 34)); g.FillEllipse(bg, 0, 0, 31, 31);
        using var fg = new SolidBrush(Color.FromArgb(213, 233, 185));
        g.FillEllipse(fg, 5, 10, 18, 12); g.FillPolygon(fg, [new Point(21, 16), new Point(28, 9), new Point(28, 23)]); g.FillEllipse(bg, 8, 13, 3, 3);
        var handle = b.GetHicon(); try { using var temporary = Icon.FromHandle(handle); return (Icon)temporary.Clone(); } finally { NativeMethods.DestroyIcon(handle); }
    }
    internal void ShowPreview(bool showSettings = false)
    {
        if (closing) return;
        if (preview == null || preview.IsDisposed) preview = new AquariumWindow(this, false) { Icon = icon };
        preview.Show(); preview.WindowState = FormWindowState.Normal; preview.Activate(); preview.Post(new { type = "suspend", paused = false });
        BroadcastDisplays(); if (showSettings) preview.OpenSettings();
    }
    internal async Task OnReady(AquariumWindow window)
    {
        window.Post(new { type = "init", wallpaper = window.IsWallpaper, settings, paused, monitorCount = window.Target?.Monitors.Count ?? 1, displayMode = display.Mode, plecoAllocation = PlecoAllocation(window) });
        if (window.IsWallpaper) { window.LastSuspended = null; return; }
        BroadcastDisplays(); BroadcastStartup(); if (startupHandled) return; startupHandled = true;
        if (Testing && !args.Contains("--startup-smoke-test")) await RunSmokeTest(window); else if (args.Contains("--wallpaper")) await ApplyWallpaper();
    }
    internal async Task ApplyWallpaper()
    {
        if (closing) return;
        if (wallpaperWanted && wallpapers.Count > 0 && !layoutBusy) { preview?.Hide(); preview?.Post(new { type = "suspend", paused = true }); return; }
        wallpaperWanted = true; await RebuildWallpapers(true);
    }
    private async Task RebuildWallpapers(bool hidePreview)
    {
        int revision = ++layoutRevision; layoutBusy = true; BroadcastDisplays();
        await layoutGate.WaitAsync();
        try {
            if (closing || !wallpaperWanted || revision != layoutRevision) return;
            CloseWallpaperWindows();
            var targets = WallpaperLayout.Build(display, Monitors());
            foreach (var target in targets) {
                var view = new AquariumWindow(this, true, target) { Icon = icon, Bounds = target.Bounds };
                wallpapers.Add(view); view.Show(); view.AttachToDesktop();
            }
            await Task.WhenAll(wallpapers.Select(w => w.Initialized)).WaitAsync(TimeSpan.FromSeconds(30));
            if (closing || !wallpaperWanted || revision != layoutRevision) return;
            stopItem.Enabled = true;
            if (hidePreview) { preview?.Post(new { type = "suspend", paused = true }); preview?.Hide(); }
            AppLog.Write($"Wallpaper layout={display.Mode}, views={wallpapers.Count}, targets={string.Join("; ", targets.Select(t => t.Bounds.ToString()))}");
            if (hidePreview && !Testing && !startupLaunching) tray.ShowBalloonTip(2500, T("수족관이 바탕화면에 적용되었습니다", "Aquarium wallpaper applied"), T("알림 영역의 물고기 아이콘에서 모니터 배치와 설정을 바꿀 수 있습니다.", "Use the fish icon in the notification area to change layout and settings."), ToolTipIcon.Info);
        }
        catch (Exception e) {
            if (revision != layoutRevision || closing) return;
            AppLog.Write(e.ToString()); wallpaperWanted = false; CloseWallpaperWindows(); if (!startupLaunching) ShowPreview();
            preview?.Post(new { type = "toast", text = $"바탕화면에 연결하지 못했습니다: {e.Message}" });
        }
        finally { layoutGate.Release(); if (revision == layoutRevision) { layoutBusy = false; BroadcastDisplays(); } }
    }
    private void CloseWallpaperWindows()
    {
        var old = wallpapers.ToArray(); wallpapers.Clear(); foreach (var view in old) { view.Close(); view.Dispose(); } stopItem.Enabled = false;
    }
    internal void StopWallpaper() { startupTimer.Stop(); wallpaperWanted = false; ++layoutRevision; layoutBusy = false; CloseWallpaperWindows(); ShowPreview(); }
    internal void SetPaused(bool value)
    {
        paused = value; UpdateTrayLanguage();
        preview?.Post(new { type = "pause", paused }); foreach (var view in wallpapers) view.Post(new { type = "pause", paused });
    }
    internal void SaveSettings(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object || value.GetRawText().Length > 4096) return;
        settings = NormalizeSettings(value); UpdateTrayLanguage(); if (!Testing) SaveJson("settings.json", settings.GetRawText());
        preview?.Post(new { type = "settings", settings, plecoAllocation = (int?)null }); foreach (var view in wallpapers) view.Post(new { type = "settings", settings, plecoAllocation = PlecoAllocation(view) });
    }
    private int? PlecoAllocation(AquariumWindow window)
    {
        if (!window.IsWallpaper) return null;
        int count = settings.TryGetProperty("plecoCount", out var value) && value.TryGetInt32(out int n) ? Math.Clamp(n, 0, 8) : 0;
        var targets = WallpaperLayout.Build(display, Monitors());
        return WallpaperLayout.PlecoShare(count, targets.Count, targets.ToList().FindIndex(t => t.Key == window.Target?.Key));
    }
    internal bool ClosePreview()
    {
        if (closing) return true;
        if (wallpaperWanted) { preview?.Hide(); preview?.Post(new { type = "suspend", paused = true }); return false; }
        ExitThread(); return true;
    }
    private void CheckHealth()
    {
        if (closing || layoutBusy) return;
        if (wallpapers.Any(w => w.IsDisposed || !NativeMethods.IsWindow(w.DesktopParent))) {
            AppLog.Write("Desktop parent disappeared; restoring preview."); StopWallpaper();
            preview?.Post(new { type = "toast", text = T("Windows 탐색기가 다시 시작되어 미리보기로 복구했습니다. 다시 적용해 주세요.", "Windows Explorer restarted, so AquaPaper returned to preview mode. Apply the wallpaper again when ready.") }); return;
        }
        foreach (var view in wallpapers) {
            // Smoke tests must sample all displays even when a user's foreground app covers one.
            // The ordinary app still pauses covered displays; lock/suspend also apply in tests.
            bool suspend = sessionLocked || powerSuspended || (!Testing && NativeMethods.IsForegroundFullscreen(view.Handle, view.Target!.Bounds));
            if (view.LastSuspended != suspend) { view.Post(new { type = "suspend", paused = suspend }); view.LastSuspended = suspend; }
            view.PollCursor = !suspend && !paused;
        }
    }
    private void DisplayChanged(object? sender, EventArgs e)
    {
        try { if (!closing) dispatcher.BeginInvoke((Action)(() => { displayTimer.Stop(); displayTimer.Start(); })); } catch (InvalidOperationException) { }
    }
    private void SessionChanged(object sender, SessionSwitchEventArgs e) { sessionLocked = e.Reason is SessionSwitchReason.SessionLock or SessionSwitchReason.SessionLogoff; }
    private void PowerChanged(object sender, PowerModeChangedEventArgs e) { if (e.Mode == PowerModes.Suspend) powerSuspended = true; if (e.Mode == PowerModes.Resume) powerSuspended = false; }
    protected override void ExitThreadCore()
    {
        if (closing) return; closing = true; wallpaperWanted = false; ++layoutRevision;
        startupTimer.Stop(); startupTimer.Dispose(); dispatcher.Dispose();
        healthTimer.Stop(); healthTimer.Dispose(); displayTimer.Stop(); displayTimer.Dispose();
        SystemEvents.DisplaySettingsChanged -= DisplayChanged; SystemEvents.SessionSwitch -= SessionChanged; SystemEvents.PowerModeChanged -= PowerChanged;
        CloseWallpaperWindows(); tray.Visible = false; tray.Dispose(); preview?.Close(); preview?.Dispose(); icon.Dispose(); base.ExitThreadCore();
    }
}
