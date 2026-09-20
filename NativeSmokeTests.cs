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
            if (args.Contains("--mixed-species")) {
                var mixed = settings.Deserialize<Dictionary<string, JsonElement>>()!;
                mixed["rummyCount"] = JsonSerializer.SerializeToElement(24);
                SaveSettings(JsonSerializer.SerializeToElement(mixed));
            }
            if (args.Contains("--pleco-test")) {
                var configured = settings.Deserialize<Dictionary<string, JsonElement>>()!;
                configured["plecoCount"] = JsonSerializer.SerializeToElement(999);
                SaveSettings(JsonSerializer.SerializeToElement(configured));
                if (settings.GetProperty("plecoCount").GetInt32() != 8) throw new InvalidOperationException("Native pleco limit was bypassed.");
            }
            await Task.Delay(4000);
            var before = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
            object? modeSwitch = null;
            var qualityCases = new List<JsonElement>();
            if (settings.GetProperty("fishMode").GetString() == "tetra3d") {
                if (!before.GetProperty("tetra").GetProperty("ready").GetBoolean() || before.GetProperty("settings").GetProperty("fishMode").GetString() != "tetra3d") throw new InvalidOperationException("3D mesh did not initialize");
                await window.CaptureFrame(Path.Combine(folder, "tetra-scene.png"));
                var tetraSettings = settings.Deserialize<Dictionary<string, JsonElement>>()!;
                var legacySettings = new Dictionary<string, JsonElement>(tetraSettings);
                legacySettings["fishMode"] = JsonSerializer.SerializeToElement("classic");
                window.Post(new { type = "settings", settings = legacySettings }); await Task.Delay(350);
                var classic = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
                if (classic.GetProperty("settings").GetProperty("fishMode").GetString() != "classic") throw new InvalidOperationException("Classic mode could not be restored");
                foreach (var quality in new[] { "high", "eco" }) {
                    var stress = new Dictionary<string, JsonElement>(tetraSettings);
                    stress["count"] = JsonSerializer.SerializeToElement(160);
                    stress["quality"] = JsonSerializer.SerializeToElement(quality);
                    window.Post(new { type = "settings", settings = stress }); await Task.Delay(2200);
                    qualityCases.Add(JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone());
                }
                window.Post(new { type = "settings", settings = tetraSettings }); await Task.Delay(600);
                var back = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
                var f = back.GetProperty("tetra").GetProperty("sample")[0];
                double aspect = back.GetProperty("width").GetDouble() / back.GetProperty("height").GetDouble();
                double w = 1 - f.GetProperty("z").GetDouble() / 2.7;
                double x = (.5 * aspect + (f.GetProperty("x").GetDouble() - .5 * aspect) / w) / aspect;
                double y = .5 + (f.GetProperty("y").GetDouble() - .5) / w;
                window.Post(new { type = "cursor", x, y, active = true, speed = 2 }); await Task.Delay(120);
                var escaped = JsonDocument.Parse(await window.Diagnostics()).RootElement.Clone();
                window.Post(new { type = "cursor", x, y, active = false, speed = 0 });
                if (escaped.GetProperty("tetra").GetProperty("sample")[0].GetProperty("panic").GetDouble() < .1) throw new InvalidOperationException("3D projected cursor did not trigger escape");
                modeSwitch = new { classic, back, escaped };
            }
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
            var report = new { preview = before, pausedAt, pausedLater, desktopAttached = attached, wallpaper = wallpaperReport, restored, cleanedUp, modeSwitch, qualityCases,
                monitors = Monitors().Select(m => new { id = m.Id, m.Number, m.Primary, bounds = Rect(m.Bounds) }), cases };
            File.WriteAllText(Path.Combine(folder, "smoke-test.json"), JsonSerializer.Serialize(report, JsonOptions));
            AppLog.Write("Smoke test complete.");
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(folder, "smoke-test-error.txt"), e.ToString()); }
        finally { ExitThread(); }
    }
}
