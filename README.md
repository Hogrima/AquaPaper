# AquaPaper

**v1.5.0:** 좌우 구성이 다른 강가의 숲과 10개 이미지 레이어로 만든 열대 산호 수조를 선택할 수 있습니다. 산호 수조에는 Blender 3D 물고기 5종이 함께합니다. / Adds an asymmetric river forest and a tropical reef built from ten image planes, with five original Blender 3D fish species. [강가의 숲 / River forest](docs/LAYERED-BACKGROUNDS.md) · [산호 수조 / Tropical reef](docs/TROPICAL-REEF.md)

**v1.4.0:** 6개 깊이 레이어, 수면·기포·부유물 효과와 개별 유영 개선을 포함합니다. / Includes six depth layers, water, bubbles, suspended particles and individual swimming improvements. [릴리즈 안내 / release guide](docs/ATMOSPHERE.md)

**v1.3.0:** Windows 자동 시작, 탭형 설정, Blender 러미노즈·플레코 추가·제거 기능을 포함합니다. [릴리즈 안내 / release guide](docs/NEXT-VERSION.md) · [플레코 피부·행동 / Pleco skin and behavior](docs/PLECO.md).

**커서에 반응하는 나만의 수족관 바탕화면 · An interactive aquarium wallpaper for Windows**

[한국어 설명서](README.ko.md) · [English documentation](README.en.md) · [최신 버전 다운로드 / Download](https://github.com/Hogrima/AquaPaper/releases/latest)

기본 물고기 표현은 Blender로 제작한 **3D 네온테트라**이며 기존 모드도 선택할 수 있습니다. 설정에서 UI를 **한국어 / English**로 바꿀 수 있고 모든 환경 설정은 자동 저장됩니다. / The default fish appearance is an original Blender-based **3D neon tetra**, with the classic mode still available. Choose **한국어 / English** in Settings; all preferences are saved automatically. [사용법·모델·행동 근거 / Guide and behavior](docs/3D-BEHAVIOR.md)

![AquaPaper](docs/screenshots/aquarium.png)

## 간편 설치 / Quick install

1. [Releases](https://github.com/Hogrima/AquaPaper/releases/latest)에서 **AquaPaper-Windows-x64.zip** 다운로드 / Download the executable ZIP.
2. **전체 압축 해제** / **Extract all** files.
3. **Install.cmd** 더블 클릭 / Double-click **Install.cmd**.
4. **환경 설정 → 언어**에서 한국어 또는 English 선택 / Choose Korean or English in **Settings → Language**.
5. **모니터 배치**에서 원하는 방식 선택 / Choose a layout in **Monitor layout**.
6. **바탕화면에 적용** 클릭 / Click **Apply wallpaper**.

설치 없이 실행하려면 압축을 푼 폴더의 `AquaPaper.exe`를 여세요. 모든 파일을 함께 유지해야 합니다.

For portable use, run `AquaPaper.exe` from the extracted folder and keep all files together.

**Windows x64 · .NET 런타임 포함 / included · 관리자 권한 불필요 / no admin required**

Microsoft Edge **WebView2 Runtime**은 필요합니다 / is required. [Microsoft download](https://developer.microsoft.com/microsoft-edge/webview2/)

[한국어 설치 안내](docs/INSTALL.ko.md) · [English installation guide](docs/INSTALL.en.md)

## 멀티 모니터 / Multiple monitors

| 옵션 / Option | 동작 / Behavior |
| --- | --- |
| **한 화면만 / One display** | 선택한 모니터에만 표시 / Display on the selected monitor only |
| **모두 이어서 / Span all** | 모든 화면을 하나의 수족관으로 연결 / One continuous aquarium across all displays |
| **화면마다 따로 / Separate** | 화면마다 독립된 수족관 / An independent aquarium on each display |

![Monitor settings](docs/screenshots/multi-monitor.png)

배치도에서 모니터를 선택할 수 있고, 적용 중 변경 사항은 바로 반영됩니다. 언어·물고기 표현·조명·품질을 포함한 설정과 모니터 구성은 저장됩니다.

Choose displays in the layout diagram. Changes apply immediately in wallpaper mode, and preferences are saved. The UI language can be switched between Korean and English in Settings.

## 기능 / Features

- 커서를 피해 흩어졌다가 다시 모이는 물고기 / Fish flee the cursor and gradually regroup.
- 12–160마리, 조명 3종, 기포와 수중 효과 / 12–160 fish, three lighting presets, bubbles and underwater effects.
- 기본 3D 네온테트라와 기존 모드 / 3D neon tetra by default, with the classic mode available.
- 한·영 UI 선택과 자동 저장 / Korean or English UI with automatic preference saving.
- 30/60fps 품질 옵션과 자동 일시정지 / 30/60fps quality options and automatic pausing.
- 트레이 제어, 전체 화면, 오프라인 실행 / Tray controls, fullscreen preview and offline operation.

수조 배경은 사실적인 이미지와 실시간 효과를 합성한 **2.5D** 방식입니다. 기본 물고기는 **3D 메시**이며 기존 셰이더도 선택할 수 있습니다. / The scenery uses a **2.5D** background; the default fish use the **3D mesh** mode, with the original shader still available.

## 개발 / Development

.NET 10 SDK · Node.js 20+

```powershell
git clone https://github.com/Hogrima/AquaPaper.git
cd AquaPaper
dotnet run
node --test tests/*.test.mjs
dotnet run --project tests/LayoutTests
.\build.ps1 -Portable -Zip
```

C# / Windows Forms / WebView2 / WebGL 2. 실제 3대 모니터에서 단일·연결·개별 모드를 검증했습니다. / Single, span and separate modes were verified on three physical monitors.

[구현 및 검증 기록 / Verification](docs/multi-monitor-verification.md) · [Third-party notices](THIRD-PARTY-NOTICES.md)
