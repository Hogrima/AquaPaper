# AquaPaper 간편 설치

[English](INSTALL.en.md) · [전체 사용 설명서](../README.ko.md)

1. [최신 릴리스](https://github.com/Hogrima/AquaPaper/releases/latest)에서 **AquaPaper-Windows-x64.zip**을 받습니다.
2. ZIP을 우클릭하고 **압축 풀기 / 모두 추출**을 선택합니다.
3. 압축이 풀린 `AquaPaper` 폴더의 **Install.cmd**를 더블 클릭합니다.
4. 설치 후 자동으로 열린 앱에서 **환경 설정 → 모니터 배치**를 선택합니다.
5. **바탕화면에 적용**을 누릅니다.

관리자 권한이나 .NET 별도 설치가 필요하지 않습니다. Microsoft Edge WebView2 Runtime이 없는 PC는 [Microsoft 공식 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)을 먼저 설치하세요. 압축 안의 EXE만 꺼내지 말고 전체를 추출해야 합니다. GitHub의 `Source code` 파일은 실행용 패키지가 아닙니다.

| 원하는 모습 | 선택할 옵션 |
| --- | --- |
| 특정 모니터 한 대 | **한 화면만** → 모니터 번호 선택 |
| 모든 모니터가 이어진 하나의 수족관 | **모두 이어서** |
| 각 모니터에 독립된 수족관 | **화면마다 따로** |

설치 위치: `%LOCALAPPDATA%\Programs\AquaPaper`. 바탕화면과 시작 메뉴에 바로가기가 생깁니다. 설치 없이 쓰고 싶다면 압축을 푼 폴더의 `AquaPaper.exe`를 직접 실행하세요.

업데이트: 트레이의 **AquaPaper 종료** → 새 실행용 ZIP 다운로드·압축 해제 → 새 폴더의 `Install.cmd` 실행. 기존 설정은 유지됩니다.

제거: 트레이에서 종료한 뒤 설치 폴더의 **Uninstall.cmd** 실행. 앱과 바로가기만 제거하고 `%LOCALAPPDATA%\AquaPaper`의 설정은 남깁니다. 설치하지 않은 휴대용 버전은 종료 후 압축을 푼 폴더를 지우면 됩니다.
