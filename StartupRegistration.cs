using Microsoft.Win32;

namespace AquaPaper;

// Per-user, visible in Windows Startup Apps. No scheduled task or elevation is needed.
internal sealed class StartupRegistration(string executable, string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Run")
{
    internal const string ValueName = "AquaPaper";
    internal static string Command(string executable) => $"\"{Path.GetFullPath(executable)}\" --startup --wallpaper";
    internal string? Read()
    {
        using var key = Registry.CurrentUser.OpenSubKey(keyPath);
        return key?.GetValue(ValueName) as string;
    }
    internal void Set(bool enabled)
    {
        using var key = Registry.CurrentUser.CreateSubKey(keyPath, true);
        if (enabled) key.SetValue(ValueName, Command(executable), RegistryValueKind.String);
        else key.DeleteValue(ValueName, false);
        if (Read() != (enabled ? Command(executable) : null)) throw new IOException("Windows startup preference was not saved.");
    }
    internal static bool DisabledByWindows()
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run");
        return key?.GetValue(ValueName) is byte[] { Length: > 0 } value && value[0] is 3 or 7;
    }
}
