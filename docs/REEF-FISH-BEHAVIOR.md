# 산호 어종의 생태 반영 / Reef fish behavior references

이 수조는 실제 생물의 관찰된 행동을 **화면에서 구분되는 규칙**으로 옮긴 시각화입니다. 이동 속도·개체수·서식 면적은 실제 수조의 사육 기준이나 실측 생태 모형이 아닙니다. 배경 그림에는 말미잘과 정확한 3D 산호 지형이 없으므로, 화면 속 암초 위치를 쉼터·채식 장소의 근사 좌표로 사용합니다. 커서는 모든 종에 일시적인 교란을 줍니다.

This is a behavior-inspired visualization, not a calibrated ecological or husbandry model. The rendered background has no host anemone or 3D coral collision mesh, so reef positions stand in for shelter and foraging locations. Cursor proximity is a transient disturbance for every species.

| Species | Evidence | Implemented behavior |
| --- | --- | --- |
| Clownfish, *Amphiprion ocellaris* | A [host-choice/activity experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC6850181/) reports host association and activity differences. | Several persistent reef home sites, local hovering and brief excursions; no claim that the painted coral is a true anemone. |
| Yellow tang, *Zebrasoma flavescens* | [Tagging and telemetry](https://doi.org/10.1007/s10641-011-9771-9) found repeated use of daytime foraging areas and movements to refuge or spawning sites. | Weak site fidelity and lower reef-foraging preference, with less compulsory schooling. The wallpaper does not simulate a day-long migration. |
| Blue tang, *Paracanthurus hepatus* | [Reef observations](https://stri-sites.si.edu/docs/publications/pdfs/ross_27.pdf) describe loose aggregations, transient subgroups and feeding in the water column and on the substrate. | Local, changeable neighbors and water-column foraging; individuals can spread out. |
| Moorish idol, *Zanclus cornutus* | The [Australian Museum species account](https://australian.museum/learn/animals/fishes/moorish-idol-zanclus-cornutus-linnaeus-1758/) records a long snout probing reef crevices, solitary fish, pairs and occasional schools; its listed length reaches 24 cm. | Large body (about 21.5 cm in the scene scale), at most four individuals, partner affinity instead of whole-species schooling, and repeated lower-reef foraging passes. The pairing force and timing are visual parameters, not measured values. |
| Dwarf hawkfish, *Cirrhitichthys falco* | A [pectoral-fin study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9617210/) documents lack of a swim bladder, perching on free lower fin rays and rhythmic pectoral strokes in slow swimming. The [Australian Museum account](https://australian.museum/learn/animals/fishes/dwarf-hawkfish-cirrhitichthys-falco/) gives roughly 7 cm length and reddish spots. | Small body (about 6.8 cm), at most six individuals, frequent rests on designated reef ledges, short exploration darts and immediate release from a perch on cursor disturbance. Perch positions approximate visible coral shelves. |

The five Blender sources carry distinct body sections, vertex pigmentation, fins, eyes, gill seams and fin rays. The live WebGL shader adds object-space scale edges, micro-normal relief, species roughness, dwarf-hawkfish spots and fin grain. Screen derivatives fade details that would otherwise alias as a fish recedes. Full and reduced meshes share the same appearance logic.

Implementation: [`web/simulation3d.js`](../web/simulation3d.js), [`web/fish3d.js`](../web/fish3d.js), [`scripts/build-coral-fish.py`](../scripts/build-coral-fish.py). The behavioral test samples 90 seconds of simulated movement and checks both time on a hawkfish perch and partner distance for idols.
