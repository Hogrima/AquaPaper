using System.Drawing;

namespace AquaPaper;

internal sealed record DisplayOptions(string Mode = "single", string? MonitorId = null)
{
    internal DisplayOptions Validated() => new(Mode is "single" or "span" or "separate" ? Mode : "single", MonitorId);
}

internal sealed record MonitorInfo(string Id, int Number, bool Primary, Rectangle Bounds)
{
    internal string Label => $"모니터 {Number} · {Bounds.Width} × {Bounds.Height}{(Primary ? " (주 모니터)" : "")}";
}

internal sealed record WallpaperTarget(string Key, Rectangle Bounds, IReadOnlyList<MonitorInfo> Monitors)
{
    // Screen and cursor coordinates are physical pixels, including negative desktop origins.
    internal (double X, double Y, bool Active) NormalizeCursor(Point point) => (
        (double)(point.X - Bounds.X) / Math.Max(1, Bounds.Width),
        (double)(point.Y - Bounds.Y) / Math.Max(1, Bounds.Height),
        Monitors.Any(m => m.Bounds.Contains(point)));
}

internal static class WallpaperLayout
{
    // An aquarium-wide limit must not turn into 24 fish on three separate displays.
    internal static int PlecoShare(int requested, int targets, int index)
    {
        int total = Math.Clamp(requested, 0, 8);
        if (targets < 1 || index < 0 || index >= targets) return 0;
        return total / targets + (index < total % targets ? 1 : 0);
    }
    internal static Rectangle Union(IReadOnlyList<MonitorInfo> monitors) => monitors.Count == 0
        ? Rectangle.Empty : monitors.Select(m => m.Bounds).Aggregate(Rectangle.Union);

    internal static IReadOnlyList<WallpaperTarget> Build(DisplayOptions options, IReadOnlyList<MonitorInfo> monitors)
    {
        if (monitors.Count == 0) throw new InvalidOperationException("연결된 모니터가 없습니다.");
        options = options.Validated();
        if (options.Mode == "span") return [new("span", Union(monitors), monitors.ToArray())];
        if (options.Mode == "separate") return monitors.Select(m => new WallpaperTarget(m.Id, m.Bounds, [m])).ToArray();
        var target = monitors.FirstOrDefault(m => m.Id == options.MonitorId) ?? monitors.FirstOrDefault(m => m.Primary) ?? monitors[0];
        return [new(target.Id, target.Bounds, [target])];
    }
}
