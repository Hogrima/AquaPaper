# 열대 산호 수조 / Tropical coral reef · AquaPaper v1.5.0

환경 설정 → 수조 → **열대 산호 수조**를 선택합니다. 기존 강가의 숲과 수중 정원도 그대로 선택할 수 있으며, 선택은 자동 저장됩니다. 산호 수조에서는 Blender 3D 물고기 모드가 자동 적용되고 담수 어종과 플레코는 나타나지 않습니다. 물고기 탭에서 전체 마릿수를 조절하면 흰동가리, 노란양쥐돔, 블루탱, 무어리시 아이돌, 난쟁이매에 배분됩니다. 큰 아이돌은 최대 4마리, 암초에 앉는 난쟁이매는 최대 6마리입니다.

Choose **Settings → Aquarium → Tropical coral reef**. The original garden and river forest remain available, and the choice is saved automatically. Reef mode uses 3D fish; freshwater fish and plecos are hidden. Change the total count in the Fish tab to update the mix of clownfish, yellow tangs, blue tangs, Moorish idols and dwarf hawkfish. The large idols are capped at four and reef-perching hawkfish at six.

실제 이미지 10장은 수면·모래 기본판, 뒤쪽의 깊은 암초 능선·왼쪽 첨탑·오른쪽 자연 아치·중간 협곡 4장, 기존 산호 능선과 좌우 중경 암초, 좌우 전경 산호로 나뉩니다. 각 이미지가 다른 깊이에서 150초 주기의 작은 시선 이동에 따라 움직이고, 가까운 산호는 물고기 앞에 그려져 가림 효과를 냅니다. 이미지에는 물고기가 들어 있지 않습니다. 제작 프롬프트와 원본 경로는 [`assets-source/coral-reef-prompts.json`](../assets-source/coral-reef-prompts.json)에 보관했습니다.

The ten separately generated plates are water and sand, four distant formations (abyssal ridge, left spires, right arch and a receding canyon), the original reef ridge, left and right mid-depth rocks, and two near coral clusters. Each has its own depth in the slow 150-second camera orbit; near coral occludes fish. Fish are rendered live rather than embedded in the photographs. The image prompts and provenance are stored in [`assets-source/coral-reef-prompts.json`](../assets-source/coral-reef-prompts.json).

Blender 소스 파일은 `assets-source/coral-{clown,yellow-tang,blue-tang,moorish-idol,dwarf-hawkfish}.blend`입니다. 종별 몸체 단면, 눈, 아가미선, 지느러미 막·지느러미살, 미세 표면 범프 및 꼬리 shape key를 포함합니다. 무어리시 아이돌은 높은 몸체·검은 띠·길게 휘는 등지느러미, 난쟁이매는 작은 체구·붉은 반점·등지느러미 가시와 받침 역할의 가슴지느러미살을 별도로 모델링했습니다. WebGL용 전체 메시와 저해상도 메시, GLB를 함께 내보냅니다. 실시간 렌더러의 물체 좌표 기반 비늘·반점·미세 요철·지느러미 결은 멀어질수록 필터링해 무늬가 깜박이지 않도록 했습니다. [생태 자료와 행동 반영 범위](REEF-FISH-BEHAVIOR.md)를 참고하세요.

Editable Blender sources live in `assets-source/coral-{clown,yellow-tang,blue-tang,moorish-idol,dwarf-hawkfish}.blend`. Each includes species-specific body sections, eyes, gill lines, fin membranes and rays, fine surface bump, and tail shape keys. The Moorish idol has a deep banded body and long dorsal pennant; the small hawkfish has reddish spots, dorsal cirri and free lower pectoral rays. Full and reduced WebGL meshes plus GLB files are exported alongside them. Object-space scale, spot, microrelief and fin details in the live renderer are filtered at distance to avoid shimmer. See the [ecology sources and behavior mapping](REEF-FISH-BEHAVIOR.md).

모델 다시 생성 / Rebuild models:

```powershell
foreach ($species in 'clown','yellow-tang','blue-tang','moorish-idol','dwarf-hawkfish') {
  & 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --threads 4 --python-exit-code 1 --python scripts/build-coral-fish.py -- --species $species
}
```

검증 / Verify:

```powershell
npm test
dotnet build AquaPaper.csproj -c Release -r win-x64 --no-restore -p:RuntimeFrameworkVersion=10.0.12
.\bin\Release\net10.0-windows\win-x64\AquaPaper.exe --smoke-test --coral-test --depth-test --output=C:\Codex\AquaPaper\artifacts\coral-reef-check
node scripts/verify-smoke.mjs artifacts/coral-reef-check/smoke-test.json
```

네이티브 검증은 단일 화면에서 수행했습니다. 멀티 모니터에서의 새 배경 렌더링은 별도 확인이 필요합니다. / Native verification used one display; the new background rendering needs separate validation across multiple monitors.
