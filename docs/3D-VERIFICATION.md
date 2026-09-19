# 3D 검증 / 3D validation

2026-09-19, Windows 로컬 개발 환경.

- Blender 5.2.2 LTS: 원본 모델 생성, 전체·경량 메시 및 GLB 내보내기, Cycles 1,400×900 정지 렌더 확인.
- Node 테스트 23개 통과: 기존 물고기 반응·설정·다중 모니터 렌더 예산, 한·영 번역, 3D 모드 설정 호환성·입체 이동·원근 커서 회피·메시·법선·GLB·LOD 유효성.
- .NET Release 빌드: 경고 0개, 오류 0개.
- 네이티브 통합 검사는 실제 1920×1080 모니터 3대를 사용합니다. 최종 결과 JSON·스크린샷은 `artifacts/tetra-native-final/`에 보관합니다. 모든 경우에 WebGL 오류 0개, JavaScript 오류 0개였습니다.

| 최종 측정 / Final sample | 물고기 / Fish | 품질 / Quality | FPS |
| --- | --- | --- | --- |
| 미리보기 / Preview | 72 | Balanced | 60 |
| 단일 화면 1·2·3 / Each single display | 72 | Balanced | 60 / 60 / 60 |
| 전체 연결 / 5760×1080 span | 72 total | Balanced | 54 |
| 화면마다 따로 / Separate displays | 72 per display | Balanced | 59 / 59 / 59 |
| 최대 개체 수 미리보기 / Maximum population preview | 160 | High | 60 |
| 최대 개체 수 절전 / Maximum population Eco | 160 | Eco | 30 |

각 배치가 준비된 뒤 약 2.5초 시점의 FPS 표본입니다. 장시간 평균이나 다른 장치에서의 성능 보장은 아닙니다. The table contains short samples after layout initialization, not a sustained benchmark. An earlier full-mesh run measured 34 FPS spanning and about 30 FPS separately; the lighter mesh reduces the vertex workload, while other foreground GPU work also affects comparisons.

![Native 3D testbed](screenshots/tetra-scene.png)

Native integration covers original/3D switching, projected cursor escape, maximum population, High/Eco geometry, all three single-monitor choices, a 5760×1080 span, three independent aquariums, pause/resume, rapid layout changes and desktop cleanup. The release package is built from the same validated source tree.

검사 모드에서는 앞에 떠 있는 전체 화면 앱에 의한 자동 일시정지만 제외하여 모든 화면을 측정합니다. 일반 실행의 전체 화면 감지는 유지됩니다. 화면 잠금·절전과 수동 일시정지는 검사 모드에서도 유지됩니다. The native benchmark suppresses foreground-fullscreen auto-pausing only while testing, so another app cannot invalidate a display's FPS sample. Normal operation retains that optimization; session/power suspension and manual pause remain enabled in tests.

Physical cable removal, other GPUs and other Windows versions are not covered by this run. Synthetic tests cover changing aspect ratios and bounded 3D motion. Frame rates are measurements on the test PC, not hardware-independent guarantees.
