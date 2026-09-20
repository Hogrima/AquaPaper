# AquaPaper

**v1.3.0:** Includes Windows startup, larger tabbed settings, and original Blender rummy-nose tetra and pleco models with species controls. [Release guide](docs/NEXT-VERSION.md) · [Detailed pleco skin, attachment and shelter behavior](docs/PLECO.md). Plecos are limited to eight across the desktop.

[한국어](README.ko.md) · [English](README.en.md) · [Download / Releases](https://github.com/Hogrima/AquaPaper/releases/latest)

A calm, interactive aquarium wallpaper for Windows. Schools of silver-and-red neon tetras react to your mouse, scatter when you approach, and gradually regroup. A forest-green aquascape, driftwood, underwater plants, moving light and floating particles create the scene. The default fish appearance is the Blender-based **3D neon tetra**; the original mode remains available.

![AquaPaper preview](docs/screenshots/aquarium.png)

## Quick installation

1. Download **AquaPaper-Windows-x64.zip** from the [latest release](https://github.com/Hogrima/AquaPaper/releases/latest). The separate **Source code** ZIP is for development.
2. **Extract all** files.
3. Double-click **Install.cmd**. The installer displays Korean and English instructions, copies the app to your user folder, and creates Desktop and Start menu shortcuts.
4. Open **환경 설정 (Settings) → 언어 (Language)** to choose Korean or English, then choose **모니터 배치 (Monitor layout)** and click **바탕화면에 적용 (Apply wallpaper)**.

The installation folder is `%LOCALAPPDATA%\Programs\AquaPaper`. Administrator access and a separate .NET installation are not required; the release bundles .NET. **Microsoft Edge WebView2 Runtime** is required. If missing, install the Evergreen Runtime from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/). Tested on Windows 11 x64.

For portable use, simply run **AquaPaper.exe** from the extracted folder. Keep the entire folder together, including `web` and the DLLs. No account or API key is needed. Choose Korean or English in Settings; the choice is saved with the rest of your preferences.

To update, select **AquaPaper 종료 (Exit)** from the tray menu, extract the new release, and run its `Install.cmd`. To remove an installed copy, run **Uninstall.cmd** in the installation folder. Preferences are preserved. Installation does not register automatic startup or change your saved Windows background image.

[Installation-only guide](docs/INSTALL.en.md)

## Multiple monitors

![Monitor layout settings](docs/screenshots/multi-monitor.png)

Choose a mode in **환경 설정 → 모니터 배치**, or right-click the fish icon in the system tray and open **모니터 배치**.

| UI option | Mode | Behavior |
| --- | --- | --- |
| 한 화면만 | One display | Choose a monitor by its number in the diagram or the dropdown. Other displays keep their normal wallpaper. |
| 모두 이어서 | Span all displays | One continuous aquarium covers the Windows desktop layout. Fish and cursor interaction continue across display boundaries. Fish count applies to the entire aquarium. |
| 화면마다 따로 | Separate aquariums | Every connected monitor gets an independent aquarium. Appearance settings are shared, and fish count applies to each display. |

Layout changes take effect immediately when wallpaper mode is already active. The selected mode and display are remembered between sessions. Negative coordinates, stacked monitors and mixed display scaling are handled using physical screen coordinates.

The diagram reflects Windows display settings. Arrange your displays there to match their physical positions. Spanning uses the bounding rectangle of all monitors and scales the background to fill it, so wide layouts can crop the top and bottom of the image. Gaps between displays and areas below shorter monitors are part of the virtual scene; fish can temporarily pass through those invisible areas.

Adding, removing or resizing a display triggers automatic layout rebuilding. If a selected display disconnects, AquaPaper temporarily uses the primary display and restores the preference when it reconnects. An Explorer restart returns the app to preview mode if the wallpaper parent window is lost.

Separate mode pauses only a display covered by a foreground fullscreen application. Span mode pauses only when the entire aquarium is covered. The render budget scales with monitor count and remains bounded by GPU limits. Three 1920 × 1080 screens render as **5760 × 1080** in balanced mode. Use Eco mode if GPU usage is too high.

## Controls

| Control | Action |
| --- | --- |
| Mouse pointer | Nearby fish move away and later regroup |
| Space | Pause / resume |
| F | Toggle fullscreen preview |
| S | Open / close settings |
| Esc | Close settings or exit fullscreen |
| Double-click the tray fish | Open the preview |

Preview controls fade after 8.5 seconds of inactivity and reappear on input. Wallpaper mode hides the UI. Desktop icons retain normal mouse behavior; the wallpaper reads cursor position separately and does not react through other applications.

Settings include Korean/English language selection, 3D neon tetra or classic fish appearance (3D by default), 12–160 fish (72 by default), natural/dusk/moonlight lighting, swimming speed, cursor interaction and particles. Changes are saved automatically to `%LOCALAPPDATA%\AquaPaper\settings.json`. Quality options target:

| Setting | Single-display resolution cap | Frame limit |
| --- | --- | --- |
| 절전 / Eco | 1280 px longest edge | 30 fps |
| 균형 / Balanced | 1920 px longest edge | 60 fps |
| 선명 / High | 2560 px longest edge | 60 fps |

Actual performance depends on hardware and power conditions. Rendering pauses when the preview is minimized, the session is locked or suspended, or the relevant wallpaper area is covered by a fullscreen app.

## Exit and local data

Closing the preview keeps the app in the tray while wallpaper mode is active. To stop it completely, choose **AquaPaper 종료** in the tray menu. Your previous Windows background becomes visible again.

| Data | Location |
| --- | --- |
| Aquarium preferences | `%LOCALAPPDATA%\AquaPaper\settings.json` |
| Monitor layout | `%LOCALAPPDATA%\AquaPaper\display-settings.json` |
| Diagnostic log | `%LOCALAPPDATA%\AquaPaper\app.log` |
| Browser cache | `%LOCALAPPDATA%\AquaPaper\WebView2` |

Content is loaded locally. No external content server, account, API key or remote fonts are required.

## Implementation

The native host uses **C# / .NET 10 / Windows Forms / WebView2**. Rendering uses **WebGL 2 and GLSL**. Scenery uses a **2.5D background** with animated distortion, lighting and particles. The default fish use an original **Blender 3D mesh**, while the original procedural shader remains selectable. This is not a fully modeled 3D tank or a looping video.

Fish behavior computes cohesion, alignment, separation, wandering, boundary avoidance and cursor escape each frame. Instanced rendering draws the fish together. Neighbor simulation is O(n²), bounded to 160 fish per aquarium. Rendering uses up to three draw calls per view in the original mode and four in 3D mode, which separates opaque bodies from translucent fins.

The wallpaper host attaches to Windows `WorkerW` / `Progman`, including the raised desktop path used by recent Windows 11 releases. This shell integration can be affected by Windows updates or other wallpaper applications. On failure, the preview remains available. Avoid using another dynamic wallpaper application on the same displays simultaneously.

| File | Responsibility |
| --- | --- |
| `Program.cs`, `AquariumApp.cs` | Lifetime, tray, settings, power and display events |
| `WallpaperLayout.cs` | Single, span and separate layouts; cursor coordinates |
| `NativeMethods.cs` | Win32 desktop attachment and foreground detection |
| `AquariumWindow.cs` | WebView2 host and native messaging |
| `web/simulation.js` | Fish behavior |
| `web/renderer.js` | GPU renderer and shaders |
| `web/app.js`, `web/display.js`, `web/i18n.js` | Controls, display diagram, language selection and frame budgeting |
| `installer/Install.ps1` | Per-user installation, update and removal |

## Build and test

Requirements: .NET 10 SDK; Node.js 20+ for tests and browser preview.

```powershell
git clone https://github.com/Hogrima/AquaPaper.git
cd AquaPaper
dotnet restore
dotnet run

node --test tests/*.test.mjs
dotnet run --project tests/LayoutTests

# Self-contained Windows x64 package and ZIP
.\build.ps1 -Portable -Zip

# Install/update/uninstall checks, without modifying real shortcuts
powershell -NoProfile -ExecutionPolicy Bypass -File tests/installer.test.ps1

# Browser-only preview at http://127.0.0.1:4173
node scripts/preview.mjs
```

Wallpaper attachment requires the native Windows app. The browser preview supports the scene and cursor interaction only.

```powershell
# Apply immediately at startup
.\dist\AquaPaper\AquaPaper.exe --wallpaper

# Open the settings panel
.\dist\AquaPaper\AquaPaper.exe --settings

# Temporarily applies layouts, verifies them, restores the desktop, and exits
.\dist\AquaPaper\AquaPaper.exe --multi-smoke-test --output=C:\Codex\AquaPaper\artifacts\multi-monitor
node scripts/verify-smoke.mjs artifacts/multi-monitor/smoke-test.json
```

Exit other AquaPaper instances before running native integration tests. The multi-monitor test verifies actual window bounds and parent attachment, per-display cursor routing, pause/resume, rapid mode changes, and cleanup. Test-mode monitor choices are not saved.

Validation on the development PC included three physical 1920 × 1080 displays: individual selection, 5760 × 1080 spanning and three independent aquariums all ran at 60 fps without WebGL errors. Eleven Node tests, sixteen C# layout assertions and twenty-three installer checks passed. Physical cable removal was not performed; disconnect fallback, stacked layouts and gaps were covered with synthetic geometry tests.

## Assets and dependencies

The scenery in `web/assets/aquarium.png` was generated for this project using the built-in imagegen tool. Its [generation prompt](docs/image-prompt.md) is included. Fish are rendered by code and are not baked into the image. See [third-party notices](THIRD-PARTY-NOTICES.md) for runtime and SDK licensing information.

- [Microsoft: WebView2 local content](https://learn.microsoft.com/microsoft-edge/webview2/concepts/working-with-local-content)
- [Microsoft: SetParent](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-setparent)
