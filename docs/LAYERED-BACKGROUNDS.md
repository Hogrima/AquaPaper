# 강가의 숲 / River forest · AquaPaper v1.5.0

## 사용 / Use

**환경 설정 → 수조 → 수조 배경 → 강가의 숲 · 입체**를 선택합니다. 기존 수중 정원으로 언제든 돌아갈 수 있으며 선택은 자동 저장됩니다. 배경 설정이 없는 이전 저장 파일은 기존 배경을 유지합니다.

Choose **Settings → Aquarium → Aquarium background → River forest · layered**. You can switch back to Original garden at any time. The selection persists; older saves retain the original background.

## 구성 / Composition

좌우 대칭 구도를 피했습니다. 왼쪽은 키 큰 수초·뒤쪽 군락·비스듬한 고목과 돌이 모이고, 오른쪽은 낮고 성긴 어린 수초와 넓은 모래길이 열려 있습니다. 빛은 왼쪽 위에서 들어옵니다. 각 이미지의 식물은 비슷한 올리브색 리본형 수초로 통일하고, 깊이에 따라 크기와 이동량을 다르게 배치했습니다.

The composition is asymmetric: tall plants, a smaller rear colony, diagonal driftwood and stones gather on the left; low young plants and a broad sandy channel leave the right open. All plates share upper-left light and olive ribbon-leaf foliage, with distinct sizes and parallax travel.

| 파일 / File | 내용 / Content | 시차 / Parallax |
| --- | --- | --- |
| `01-water.png` | 먼 물속·모래길·수면 / distant water, sand and surface | 0.12 |
| `02-rear-plants.png` | 왼쪽 뒤 수초 군락 / rear left plants | 0.55 |
| `03-driftwood.png` | 이끼 낀 고목 / mossy driftwood | 1.05 |
| `04-stones.png` | 왼쪽 앞 돌과 자갈 / near left stones | 1.45 |
| `05-left-plants.png` | 키 큰 앞쪽 수초 / tall near plants | 2.50 |
| `06-right-plants.png` | 오른쪽 낮은 어린 수초 / low young right plants | 3.30 |

이미지는 [web/assets/river-forest](../web/assets/river-forest)에 있습니다. 내장 **image_gen** 도구로 각각 생성·수정한 별개의 1536×1024 PNG 여섯 장입니다. 첫 이미지는 불투명이고 나머지는 실제 알파 채널이 있는 투명 이미지입니다. 16:9 수조 구도에 맞춰 같은 좌표계에 배치합니다. [생성 및 비대칭 수정 프롬프트](../assets-source/river-forest-prompts.json)를 함께 보관합니다.

Six separately generated/edited PNGs live in [web/assets/river-forest](../web/assets/river-forest). They were created with the built-in **image_gen** tool. The first is opaque; the remaining five contain genuine transparent alpha. All authoring plates share a 16:9 presentation frame. [Prompts and asymmetric revisions](../assets-source/river-forest-prompts.json) are included.

## 렌더링 / Rendering

깊이 지도나 원본 사진을 복제한 마스크 레이어를 사용하지 않습니다. 서로 다른 여섯 이미지를 각자의 위치로 이동하며, 가까운 잎이 이동한 자리에서는 뒤의 고목·수초·물속이 보입니다. 앞쪽 두 수초는 물고기와 입자 다음에 그려 가림 효과를 만듭니다. 텍스처는 로드 시 한 번 업로드하며, 미리 곱한 알파와 mipmap으로 투명 가장자리의 검은 테두리와 축소 시 깜빡임을 줄입니다. 시점은 기존 150초 궤도를 유지합니다.

No depth map or duplicated-photo opacity masks are used by either background renderer. Six distinct images move independently; near plants reveal the scenery behind them. The last two plant planes draw after fish and particles for occlusion. The tall ribbon leaves on the left and low broad leaves on the right use different authored cutouts, so the garden is not mirrored. A per-pixel inverse-flow deformation gives each leaf a different phase and bends tips more than roots. Wood, rock and open water are never warped by plant flow. Textures upload once with premultiplied alpha and mipmaps. The camera retains its 150-second orbit. This is a multiplane scene, not reconstructed volumetric geometry.

수면은 불투명한 색 띠나 별도의 조명 반사판을 덮지 않습니다. 배경 이미지 자체의 수면 반사 무늬를 작게 굴절시키고 밝기를 조정해, 배경의 색과 조명을 유지하면서 물결이 움직입니다. 수면 효과를 끄면 움직이는 굴절이 멈추지만 사진에 담긴 수면은 그대로 보입니다. 전체 일시정지는 카메라·물결·물고기 모두를 멈춥니다.

The water effect gently refracts and modulates the surface already present in the base image, preserving its color and light instead of overlaying a synthetic colored strip. Switching it off removes animated refraction while leaving the photographed surface visible. Pause freezes the entire scene.

## 검증 / Verification · 2026-09-21

- JavaScript **49개 통과**, Release 빌드 경고·오류 0 / **49 tests passed**, zero-warning Release build.
- 이미지 6장의 중복 여부, PNG 알파의 투명·불투명 영역, 전체 시점 궤도의 가장자리 여유와 연속성 검사 / Distinct assets, true alpha coverage and full-orbit bounds/continuity verified.
- 단일 화면 WebView2에서 기존/새 배경 전환, 6개 이미지 로딩, 효과 켜기/끄기, 궤도 네 방향, 수면 시간별 캡처, 3D/기존 물고기, 일시정지·재개 및 바탕화면 적용·해제 통과. JS/WebGL 오류 없음 / Single-screen native checks passed with no JS/WebGL errors.
- 브라우저에서 새 배경 선택 후 새로고침해 선택 복원을 확인 / Browser reload restored the selected scene.
- 미리보기 **60fps**, 바탕화면 **43fps**의 짧은 측정 샘플 / Short sample: **60fps** preview, **43fps** wallpaper. 고정 성능 보장은 아닙니다 / Not a performance guarantee.
- 이 배경의 네이티브 검증은 단일 화면에서 수행했습니다. 멀티 모니터 렌더링은 별도 확인이 필요합니다 / Native verification for this background used one display; multi-monitor rendering needs separate validation.

```powershell
node --test tests/*.test.mjs
dotnet build AquaPaper.csproj -c Release -r win-x64 --no-restore -p:RuntimeFrameworkVersion=10.0.12
.\bin\Release\net10.0-windows\win-x64\AquaPaper.exe --smoke-test --mixed-species --pleco-test --environment-test --depth-test --layered-test --output=C:\Codex\AquaPaper\artifacts\river-forest-check
node scripts/verify-smoke.mjs artifacts/river-forest-check/smoke-test.json
```

로컬 보고서와 캡처: `artifacts/river-forest-check/`. 테스트는 사용자 설정 파일과 시작 프로그램 등록을 변경하지 않습니다. / Reports and captures are in that local directory; the native test does not change user preference files or startup registration.
