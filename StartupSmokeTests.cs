using System.Text.Json;
using Microsoft.Win32;

namespace AquaPaper;

internal sealed partial class AquariumApp
{
    private async Task RunStartupSmokeTest()
    {
        var output = args.FirstOrDefault(a => a.StartsWith("--output="));
        var folder = output == null ? Path.Combine(AppContext.BaseDirectory, "startup-smoke-test") : Path.GetFullPath(output[9..]);
        Directory.CreateDirectory(folder);
        string testKey = @"Software\AquaPaper\StartupTests\" + Guid.NewGuid().ToString("N");
        try {
            if (preview != null) throw new InvalidOperationException("Startup opened a preview window.");
            bool noPreview = preview == null;
            if (!wallpaperWanted || wallpapers.Count == 0) throw new InvalidOperationException("Startup did not apply wallpaper.");
            await Task.Delay(3000);
            var views = await Task.WhenAll(wallpapers.Select(InspectView));
            foreach (var view in wallpapers) {
                using var doc = JsonDocument.Parse(await view.Diagnostics()); var d = doc.RootElement;
                if (!d.GetProperty("ready").GetBoolean() || d.GetProperty("webglError").GetInt32() != 0 || d.GetProperty("errors").GetArrayLength() != 0) throw new InvalidOperationException("Startup renderer failed.");
                foreach (var key in new[] { "count", "activity", "lighting", "interaction", "particles", "quality", "fishMode", "language", "rummyCount" }) {
                    if (settings.TryGetProperty(key, out var expected) && expected.GetRawText() != d.GetProperty("settings").GetProperty(key).GetRawText()) throw new InvalidOperationException($"Startup did not restore {key}.");
                }
                if (d.GetProperty("displayMode").GetString() != display.Mode || NativeMethods.GetParent(view.Handle) != view.DesktopParent) throw new InvalidOperationException("Startup did not restore the desktop layout.");
            }
            // Exercise the real registry implementation in a disposable, isolated key.
            var registration = new StartupRegistration(@"C:\Test Folder\한글\AquaPaper.exe", testKey);
            using (var key = Registry.CurrentUser.CreateSubKey(testKey)) key.SetValue("UnrelatedApp", "preserve-me");
            registration.Set(true);
            if (registration.Read() != "\"C:\\Test Folder\\한글\\AquaPaper.exe\" --startup --wallpaper") throw new InvalidOperationException("Startup command quoting failed.");
            registration.Set(false);
            using (var key = Registry.CurrentUser.OpenSubKey(testKey)) if ((string?)key?.GetValue("UnrelatedApp") != "preserve-me") throw new InvalidOperationException("Startup modified another registration.");
            await wallpapers[0].CaptureFrame(Path.Combine(folder, "startup.png"));
            // Opening settings after login must not re-run --wallpaper and hide the preview.
            ShowPreview(true); await preview!.Initialized.WaitAsync(TimeSpan.FromSeconds(30)); await Task.Delay(500);
            if (!preview.Visible) throw new InvalidOperationException("Startup hid the settings window when it was opened later.");
            await preview.CaptureFrame(Path.Combine(folder, "settings-after-startup.png"));
            StopWallpaper(); await Task.Delay(200);
            if (wallpapers.Count != 0 || !preview.Visible) throw new InvalidOperationException("Stop after startup did not restore the preview.");
            File.WriteAllText(Path.Combine(folder, "startup-test.json"), JsonSerializer.Serialize(new { noPreview, settingsOpenAfterStartup = true, stopRestoresPreview = true, attempts = startupAttempts, savedSettings = settings, savedDisplay = display, views, registryRoundTrip = true }, JsonOptions));
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(folder, "startup-test-error.txt"), e.ToString()); }
        finally { Registry.CurrentUser.DeleteSubKeyTree(testKey, false); ExitThread(); }
    }
}
