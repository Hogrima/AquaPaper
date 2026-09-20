# AquaPaper v1.4.0 — 수조 깊이·수면·유영 개선 / Atmosphere and swimming

v1.3.0 이후 추가된 수조 깊이, 수면, 입자와 개별 유영 개선 기능의 사용 방법과 검증 결과입니다.

This guide covers the depth, surface, particle and individual swimming improvements included in v1.4.0 after v1.3.0.

## 사용 방법

**환경 설정 → 수조**에서 다음 효과를 각각 켜고 끌 수 있습니다. 처음에는 모두 켜지며 선택은 자동 저장됩니다.

- **천천히 움직이는 시점**: 150초에 한 바퀴, 화면 높이의 0.8% 반지름인 작은 원을 따라 시점이 움직입니다. 먼 배경은 적게, 가까운 수초는 더 많이 움직입니다.
- **일렁이는 수면**: 화면 위쪽에 서로 다른 방향의 잔물결, 일그러진 반사, 비스듬한 시선의 반짝임을 합성합니다. 자연광·노을·달빛에 따라 색이 바뀝니다.
- **기포와 부유물**: 수초 양쪽에서 올라오는 기포와 천천히 떠도는 먼지 입자를 따로 그립니다. 기포는 수면에서 사라지고, 부유물은 모두 위로 올라가지 않고 완만하게 흐릅니다. 가까운 입자는 더 크고 부드럽게 보입니다.

전체 일시정지는 물고기뿐 아니라 시점·물결·입자도 멈춥니다. 시점 이동을 끄더라도 수면과 입자는 독립적으로 사용할 수 있습니다. 자동 시작에서도 저장한 선택을 복원합니다.

## 6개 레이어

| 깊이 순서 | 레이어 | 시차 배율 |
| --- | --- | --- |
| 1 | 먼 물속 배경 | 0.12 |
| 2 | 뒤쪽 수초 | 0.28 |
| 3 | 뒤쪽 강둑·식생 | 0.46 |
| 4 | 중앙 고목 | 0.70 |
| 5 | 모래와 바위 | 1.00 |
| 6 | 가장 가까운 수초 | 1.38 |

기존 수족관 그림을 깊이별 마스크로 나누어 **서로 다른 알파 텍스처 6개를 GPU에서 생성**합니다. 각 텍스처를 독립된 위치로 투영한 후 합성합니다. 경계는 부드럽게 겹치고 가장자리에 여유를 두어 작은 시점 변화에서 빈 틈을 줄였습니다. 원본 구도를 유지하는 **2.5D 시차 효과**이며, 고목 뒤의 보이지 않는 공간까지 새 3D 모델로 복원한 것은 아닙니다.

마스크 생성은 로드할 때 한 번만 수행합니다. 매 프레임에는 6개 텍스처를 한 번의 합성 패스로 처리하고, 빛 효과는 한 번만 계산합니다. 수면 셰이더는 위쪽 14% 영역만 그립니다. 세 화면 연결 모드에서도 물결의 공간 단위와 입자 밀도를 유지합니다.

물고기와 플레코의 커서 판정도 카메라 이동이 반영된 위치를 사용합니다. 배경만 흔들고 클릭/회피 위치가 어긋나는 방식이 아닙니다.

## 3D 물고기의 움직임

- 짧게 추진한 뒤 급격히 느려지던 감쇠를 줄여 **더 긴 관성 활주**를 만듭니다. 꼬리의 진폭과 주파수도 추진 강도에 맞춰 점진적으로 변합니다.
- **군집 유지 / 주변 탐색 / 느리게 머무르기 / 낮은 곳 훑기**를 개체마다 다른 시간에 선택합니다. 같은 무리라도 원하는 속도, 수심과 추진 주기가 다릅니다.
- 러미노즈는 상대적으로 군집 유지 비중이 높습니다. 탐색 중인 물고기도 동종 이웃과의 연결을 완전히 끊지 않으며 충돌·벽·커서 회피는 계속 작동합니다.
- 행동 전환 시 위치나 속도를 바로 덮어쓰지 않고 새 목표 속도로 서서히 접근합니다. 플레코의 부착·휴식·은신 로직은 별도로 유지됩니다.

행동 이름과 계수는 자연스러운 시각화를 위한 설계이며 종별 실측 행동을 예측하는 모델은 아닙니다. 기존 [행동 연구 참고](3D-BEHAVIOR.md)의 국소 군집과 추진·활주 원칙을 유지했습니다.

## English

Open **Settings → Aquarium** to control **Slow camera drift**, **Rippling water surface**, and **Bubbles and particles** independently. They default to on and persist with the other preferences. Pause freezes the entire scene.

The view traces a small circle with radius 0.8% of viewport height over 150 seconds. Six individually masked GPU textures represent distant water, rear plants, the rear bank, driftwood, sand/rocks and near plants. Independent depth offsets create parallax. These are 2.5D planes derived from the existing artwork, not a reconstructed volumetric aquarium. Masks are cached once; all six planes are composited in a single runtime pass. The water shader covers only the upper strip and combines crossed ripples, distorted reflections and grazing-angle highlights.

Bubbles rise from two planted areas and fade near the surface. Suspended particles drift independently with varying size, opacity and focus. Density scales with panoramic width. Fish rendering and cursor projection use the same camera offset, including attached plecos.

3D schooling fish retain more momentum after each kick. Tail amplitude and frequency ease between propulsion and gliding. Individuals choose school-following, exploration, hovering or low-water foraging-like movement on independent timers, with different preferred depths, cruise speeds and kick cycles. Rummy-nose fish favor schooling. These behavior-inspired choices are artistic parameters, not a fitted ecological prediction.

## 개발·검증 / Development and verification

- `web/scene.js`: 시점 궤도, 공통 투영, 레이어 정의, 입자 수 / camera, projection, layer metadata, particle budgets
- `web/environment.js`: 레이어 마스크·합성·수면·입자 셰이더 / masking, compositing, water and particle shaders
- `web/renderer.js`: GPU 캐시와 렌더 순서 / texture caching and render passes
- `web/simulation3d.js`: 개체별 행동과 추진·활주 / individual behavior and gait
- `tests/environment.test.mjs`: 궤도 연속성, 커서 정합성, 입자 예산, 저장 호환성, 활주 거리, 행동 다양성 / orbit, picking, budgets, persistence, glide travel and behavioral diversity

```powershell
node --test tests/*.test.mjs
dotnet build AquaPaper.csproj -c Release -r win-x64 --no-restore -p:RuntimeFrameworkVersion=10.0.12
# Close any running AquaPaper instance before the isolated native check.
.\bin\Release\net10.0-windows\win-x64\AquaPaper.exe --multi-smoke-test --mixed-species --pleco-test --environment-test --output=C:\Codex\AquaPaper\artifacts\environment-check
node scripts/verify-smoke.mjs artifacts/environment-check/smoke-test.json
```

네이티브 검사는 효과 켜기/끄기, 3D/기존 모드, 3개 모니터의 단일·연결·개별 배치, 일시정지·커서 회피·바탕화면 적용·해제를 검증하고 종료합니다. 실제 사용자 설정 파일과 자동 시작 등록은 변경하지 않습니다.

The native check temporarily attaches to the desktop and verifies effect toggles, classic/3D modes, single/spanned/separate layouts, pause, cursor escape and cleanup. It exits without changing user preference files or startup registration.

## 검증 결과 / Results · 2026-09-20

- JavaScript **43개 검사 통과**, Release 빌드 경고·오류 0 / **43 JavaScript tests passed**, zero-warning Release build.
- 실제 WebView2에서 6개 캐시 텍스처·6개 깊이 레이어, 효과 끄기/켜기, 카메라를 반영한 커서 회피, 일시정지·재개, 3D/기존 모드와 모든 모니터 배치 검증 통과. JS/WebGL 오류 없음 / Native tests verified all six cached planes, toggles, projected cursor response, pause/resume, both fish modes and all display layouts with no JS/WebGL errors.
- 브라우저에서 한·영 옵션, 개별 효과 끄기, 새로고침 후 복원과 다시 켜기를 확인 / Browser checks covered both UI languages, independent toggles and reload persistence.
- **네온 48 + 러미노즈 24 + 플레코 8**, 균형 품질: 단일 모니터별 **60/55/60fps**, 5760×1080 연결 **36fps**, 개별 수조 **33/33/34fps**. 플레코는 전체 8마리 유지 / Balanced, 48 neon + 24 rummy-nose + 8 plecos: **60/55/60fps** in single-display cases, **36fps** spanned, **33/33/34fps** separate; global pleco cap preserved.
- 군영 160 + 플레코 8 미리보기: 선명 **34fps**, 절전 **29fps** / 160 schooling fish + 8 plecos preview: High **34fps**, Eco **29fps**.

수치는 이 PC의 짧은 측정값이며, 최대 개체 수·다중 모니터에서 60fps를 보장하지 않습니다. 최종 보고서는 `artifacts/environment-verified/smoke-test.json`, 효과 비교 캡처는 같은 폴더의 `atmosphere-on.png` / `atmosphere-off.png`에 있습니다. 테스트 중 WebView2 캡처가 대기 상태에 머문 사례가 있어 캡처에 15초 제한과 중간 진단 저장을 추가한 뒤 최종 검사를 다시 통과했습니다.

These are short samples on this PC, not a 60fps guarantee at maximum population or across multiple displays. Final report: `artifacts/environment-verified/smoke-test.json`; effect comparison captures are beside it. One earlier WebView2 capture remained pending; the test now bounds capture time to 15 seconds and saves intermediate diagnostics. The final native run completed successfully.
