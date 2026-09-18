using System.Text.Json;

namespace AquaPaper;

internal sealed partial class AquariumApp
{
    private static object Rect(Rectangle r) => new { x = r.X, y = r.Y, width = r.Width, height = r.Height };
    private async Task<object> InspectView(AquariumWindow view)
    {
        NativeMethods.GetWindowRect(view.Handle, out var actual);
        var target = view.Target!;
        var samples = Monitors().Select(m => {
            var point = new Point(m.Bounds.X + m.Bounds.Width / 2, m.Bounds.Y + m.Bounds.Height / 2);
            var mapped = target.NormalizeCursor(point);
            return new { monitorId = m.Id, x = mapped.X, y = mapped.Y, active = mapped.Active };
        }).ToArray();
        return new {
            key = target.Key, target = Rect(target.Bounds), actual = Rect(Rectangle.FromLTRB(actual.Left, actual.Top, actual.Right, actual.Bottom)),
            attached = NativeMethods.GetParent(view.Handle) == view.DesktopParent,
            cursorSamples = samples, diagnostics = JsonDocument.Parse(await view.Diagnostics()).RootElement.Clone()
        };
    }

    private async Task RunSmokeTest(AquariumWindow window)
    {
        var folderArg = args.FirstOrDefault(x => x.StartsWith("--output="));
        var folder = folderArg == null ? Path.Combine(AppContext.BaseDirectory, "smoke-test") : Path.GetFullPath(folderArg[9..]);
        Directory.CreateDirectory(folder);
        try {
            await Task.Delay(4000);
            var before = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
            window.OpenSettings(); await Task.Delay(200); await window.CaptureFrame(Path.Combine(folder, "monitor-settings.png"));
            SetPaused(true); await Task.Delay(200); var pausedAt = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
            await Task.Delay(500); var pausedLater = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone(); SetPaused(false);
            var primary = Monitors().First(m => m.Primary);
            await SetDisplay(new("single", primary.Id)); await ApplyWallpaper(); await Task.Delay(2500);
            if (wallpapers.Count == 0) throw new InvalidOperationException("No wallpaper created");
            var attached = wallpapers.All(w => NativeMethods.GetParent(w.Handle) == w.DesktopParent);
            var wallpaperReport = JsonDocument.Parse(await wallpapers[0].Diagnostics()).RootElement.Clone();
            var cases = new List<object>();
            if (args.Contains("--multi-smoke-test")) {
                var choices = Monitors().Select(m => new DisplayOptions("single", m.Id))
                    .Concat([new DisplayOptions("span", primary.Id), new DisplayOptions("separate", primary.Id)]);
                foreach (var choice in choices) {
                    await SetDisplay(choice); await Task.Delay(2500);
                    if (wallpapers.Count == 0) throw new InvalidOperationException($"No wallpaper for {choice}");
                    var views = new List<object>(); foreach (var view in wallpapers) views.Add(await InspectView(view));
                    SetPaused(true); await Task.Delay(150);
                    var a = new List<double>(); foreach (var view in wallpapers) a.Add(JsonDocument.Parse(await view.Diagnostics()).RootElement.GetProperty("time").GetDouble());
                    await Task.Delay(350);
                    var b = new List<double>(); foreach (var view in wallpapers) b.Add(JsonDocument.Parse(await view.Diagnostics()).RootElement.GetProperty("time").GetDouble());
                    SetPaused(false);
                    cases.Add(new { mode = choice.Mode, monitorId = choice.MonitorId, views, pausedAt = a, pausedLater = b });
                    if (choice.Mode != "single") await wallpapers[0].CaptureFrame(Path.Combine(folder, $"{choice.Mode}.png"));
                }
                // Latest user intent must win even if WebView creation is still pending.
                var first = SetDisplay(new("span", primary.Id));
                var second = SetDisplay(new("separate", primary.Id));
                var last = SetDisplay(new("single", primary.Id));
                await Task.WhenAll(first, second, last);
                await Task.Delay(1500);
                cases.Add(new { mode = "rapid-last-single", monitorId = primary.Id, views = await Task.WhenAll(wallpapers.Select(InspectView)) });
            }
            var handles = wallpapers.Select(w => w.Handle).ToArray();
            StopWallpaper(); await Task.Delay(500);
            bool cleanedUp = wallpapers.Count == 0 && handles.All(h => !NativeMethods.IsWindow(h));
            var restored = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
            var report = new { preview = before, pausedAt, pausedLater, desktopAttached = attached, wallpaper = wallpaperReport, restored, cleanedUp,
                monitors = Monitors().Select(m => new { id = m.Id, m.Number, m.Primary, bounds = Rect(m.Bounds) }), cases };
            File.WriteAllText(Path.Combine(folder, "smoke-test.json"), JsonSerializer.Serialize(report, JsonOptions));
            AppLog.Write("Smoke test complete.");
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(folder, "smoke-test-error.txt"), e.ToString()); }
        finally { ExitThread(); }
    }
}
