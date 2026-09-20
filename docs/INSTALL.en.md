# AquaPaper quick installation

In v1.3.0, enable automatic startup in **Settings → General → Apply at Windows startup**. See the [release guide](NEXT-VERSION.md).

[한국어](INSTALL.ko.md) · [Full documentation](../README.en.md)

1. Download **AquaPaper-Windows-x64.zip** from the [latest release](https://github.com/Hogrima/AquaPaper/releases/latest).
2. Right-click the ZIP and choose **Extract All**.
3. Double-click **Install.cmd** in the extracted `AquaPaper` folder.
4. When the app opens, select **환경 설정 (Settings) → 언어 (Language)** and choose Korean or English.
5. Select **모니터 배치 (Monitor layout)**, then click **바탕화면에 적용 (Apply wallpaper)**.

No administrator privileges or separate .NET installation are required. If Microsoft Edge WebView2 Runtime is missing, install the [official Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) first. Extract the entire package, not only the EXE. GitHub's separate **Source code** downloads are not ready-to-run packages.

| Desired layout | Select |
| --- | --- |
| A single display | **한 화면만** → choose the monitor number |
| One aquarium spanning every display | **모두 이어서** |
| An independent aquarium on each display | **화면마다 따로** |

The default fish appearance is **3D neon tetra**. You can switch to **Classic** in Settings. Language, fish appearance and other preferences are saved automatically.

The app installs to `%LOCALAPPDATA%\Programs\AquaPaper` and creates Desktop and Start menu shortcuts. For portable use, skip installation and run `AquaPaper.exe` from the extracted folder.

To update, exit the app using **AquaPaper 종료** in its tray menu, download and extract the new executable ZIP, then run the new folder's `Install.cmd`. Your preferences are kept.

To uninstall, exit from the tray, then run **Uninstall.cmd** in the installation folder. It removes the app and its shortcuts, preserving preferences under `%LOCALAPPDATA%\AquaPaper`. For portable copies, exit the app and remove the extracted folder.
