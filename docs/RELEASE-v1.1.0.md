# AquaPaper v1.1.0

## 한국어

커서에 반응하는 Windows용 수족관 월페이퍼입니다. 깊은 초록빛 수중 배경 위에서 물고기가 실시간으로 헤엄치고 마우스를 피해 흩어집니다.

- **한 화면만**: 선택한 모니터에만 표시.
- **모두 이어서**: 모든 모니터를 하나의 수족관으로 연결.
- **화면마다 따로**: 모니터마다 독립된 수족관.
- 물고기 수·속도·조명·품질 설정, 모니터 배치도, 트레이 제어.
- 한국어·영어 README 및 설치 안내, 사용자별 설치와 제거 스크립트.

**설치:** 아래 **AquaPaper-Windows-x64.zip** 다운로드 → **전체 압축 해제** → **Install.cmd** 실행 → 환경 설정에서 모니터 배치 선택 → 바탕화면에 적용.

Windows x64용이며 .NET 런타임이 포함됩니다. Microsoft Edge WebView2 Runtime이 필요합니다. 설치 없이 실행하려면 압축을 푼 폴더의 `AquaPaper.exe`를 여세요. `Source code` ZIP은 개발용입니다. 업데이트 전에는 트레이에서 기존 AquaPaper를 종료하세요.

실제 1920×1080 모니터 3대에서 단일·연결·개별 모드를 검증했습니다. 연결 시 5760×1080으로 렌더링합니다. 검사 환경에서 60fps를 확인했으며 성능은 하드웨어에 따라 달라집니다. Node 테스트 11개, C# 배치 조건 16개, 설치 검사 23개를 통과했습니다.

## English

A Windows aquarium wallpaper with real-time schooling fish that react to your cursor.

- **One display:** use a selected monitor.
- **Span all:** one continuous aquarium across the desktop.
- **Separate:** an independent aquarium on each monitor.
- Fish count, speed, lighting and quality controls, display diagram and tray controls.
- Korean and English documentation, per-user setup and removal scripts.

**Install:** download **AquaPaper-Windows-x64.zip** below → **Extract all** → run **Install.cmd** → select the display layout in Settings → apply the wallpaper.

The Windows x64 package includes .NET and requires Microsoft Edge WebView2 Runtime. For portable use, run `AquaPaper.exe` from the extracted folder. The `Source code` ZIP is for developers. Exit an existing instance from its tray menu before updating. The application UI is currently Korean; the English README translates the controls.

Single, span and separate modes were verified on three physical 1920×1080 monitors, including a 5760×1080 span. The test PC rendered at 60 fps; performance depends on hardware. All 11 Node tests, 16 C# layout assertions and 23 installer checks passed.
