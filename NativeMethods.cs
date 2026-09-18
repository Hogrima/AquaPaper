using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace AquaPaper;

internal static class NativeMethods
{
    internal const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
    internal const long WS_CHILD = 0x40000000, WS_POPUP = 0x80000000L, WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x08000000, WS_EX_LAYERED = 0x80000;
    internal const uint SWP_NOACTIVATE = 0x10, SWP_SHOWWINDOW = 0x40, SWP_FRAMECHANGED = 0x20;
    [StructLayout(LayoutKind.Sequential)] internal struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int Left, Top, Right, Bottom; }
    internal delegate bool EnumWindowsProc(nint hwnd, nint param);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern nint FindWindow(string? className, string? title);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern nint FindWindowEx(nint parent, nint after, string? className, string? title);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumWindowsProc callback, nint param);
    [DllImport("user32.dll", SetLastError = true)] internal static extern nint SendMessageTimeout(nint hwnd, uint message, nint wparam, nint lparam, uint flags, uint timeout, out nint result);
    [DllImport("user32.dll", SetLastError = true)] internal static extern nint SetParent(nint child, nint parent);
    [DllImport("user32.dll")] internal static extern nint GetParent(nint hwnd);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] internal static extern nint GetWindowLongPtr(nint hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)] internal static extern nint SetWindowLongPtr(nint hwnd, int index, nint value);
    [DllImport("user32.dll", SetLastError = true)] internal static extern bool SetWindowPos(nint hwnd, nint after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] internal static extern bool ScreenToClient(nint hwnd, ref POINT point);
    [DllImport("user32.dll")] internal static extern bool GetCursorPos(out POINT point);
    [DllImport("user32.dll")] internal static extern bool GetClientRect(nint hwnd, out RECT rect);
    [DllImport("user32.dll")] internal static extern bool GetWindowRect(nint hwnd, out RECT rect);
    [DllImport("user32.dll")] internal static extern bool IsWindow(nint hwnd);
    [DllImport("user32.dll")] internal static extern nint GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetClassName(nint hwnd, StringBuilder name, int length);
    [DllImport("user32.dll")] internal static extern bool DestroyIcon(nint handle);
    [DllImport("user32.dll", SetLastError = true)] internal static extern bool SetLayeredWindowAttributes(nint hwnd, uint key, byte alpha, uint flags);
    [DllImport("user32.dll")] internal static extern nint WindowFromPoint(POINT point);
    [DllImport("user32.dll")] internal static extern nint GetAncestor(nint hwnd, uint flags);

    internal static string ClassName(nint hwnd) { var result = new StringBuilder(256); GetClassName(hwnd, result, result.Capacity); return result.ToString(); }

    internal static nint AttachDesktop(nint hwnd, Rectangle bounds)
    {
        var progman = FindWindow("Progman", null);
        if (progman == 0) throw new InvalidOperationException("Windows 바탕화면을 찾을 수 없습니다.");
        SendMessageTimeout(progman, 0x052C, 0xD, 0, 2, 1000, out _);
        SendMessageTimeout(progman, 0x052C, 0xD, 1, 2, 1000, out _);
        nint parent = 0, after = 0;
        // Recent Windows 11 uses a raised desktop: wallpaper and DefView are siblings under Progman.
        bool raised = (GetWindowLongPtr(progman, GWL_EXSTYLE).ToInt64() & 0x00200000) != 0;
        var icons = FindWindowEx(progman, 0, "SHELLDLL_DefView", null);
        if (raised && icons != 0) { parent = progman; after = icons; }
        else {
            EnumWindows((top, _) => {
                if (FindWindowEx(top, 0, "SHELLDLL_DefView", null) != 0) {
                    var candidate = FindWindowEx(0, top, "WorkerW", null);
                    if (candidate != 0) { parent = candidate; return false; }
                }
                return true;
            }, 0);
            if (parent == 0) {
                var candidate = FindWindowEx(progman, 0, "WorkerW", null);
                if (candidate != 0 && FindWindowEx(candidate, 0, "SHELLDLL_DefView", null) == 0) parent = candidate;
            }
        }
        if (parent == 0) throw new InvalidOperationException("바탕화면 레이어를 찾지 못했습니다. 미리보기는 계속 사용할 수 있습니다.");
        long style = GetWindowLongPtr(hwnd, GWL_STYLE).ToInt64();
        SetWindowLongPtr(hwnd, GWL_STYLE, (nint)((style | WS_CHILD) & ~WS_POPUP));
        long exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64() | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        if (raised) exStyle |= WS_EX_LAYERED;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, (nint)exStyle);
        if (raised) SetLayeredWindowAttributes(hwnd, 0, 255, 2);
        SetParent(hwnd, parent);
        if (GetParent(hwnd) != parent) throw new Win32Exception(Marshal.GetLastWin32Error(), "바탕화면 연결에 실패했습니다.");
        var origin = new POINT { X = bounds.X, Y = bounds.Y }; ScreenToClient(parent, ref origin);
        if (!SetWindowPos(hwnd, after, origin.X, origin.Y, bounds.Width, bounds.Height, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED)) throw new Win32Exception(Marshal.GetLastWin32Error());
        AppLog.Write($"Desktop mode={(raised ? "raised" : "classic")}, parent={parent}, icons={icons}");
        return parent;
    }

    internal static bool IsDesktopUnderCursor(POINT point, nint wallpaper)
    {
        var target = WindowFromPoint(point); var root = GetAncestor(target, 2);
        return root == wallpaper || ClassName(root) is "Progman" or "WorkerW";
    }

    internal static bool IsForegroundFullscreen(nint wallpaper, Rectangle bounds)
    {
        var fg = GetForegroundWindow(); if (fg == 0 || fg == wallpaper || ClassName(fg) is "Progman" or "WorkerW" or "Shell_TrayWnd") return false;
        if (!GetWindowRect(fg, out var r)) return false;
        // A span only pauses when all its screens are covered; separate views pause individually.
        var b = bounds;
        return r.Left <= b.Left && r.Top <= b.Top && r.Right >= b.Right && r.Bottom >= b.Bottom;
    }
}
