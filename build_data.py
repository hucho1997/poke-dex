"""GitHub CSV 기반 데이터 정규화 스크립트.
출력:
- data/generated/pokedex.json (도감/스탯)
- data/generated/encounters.json (포획)
"""
import csv
import io
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
OUT = Path('data/generated')
OUT.mkdir(parents=True, exist_ok=True)

FILES = [
    'pokemon.csv', 'pokemon_species.csv', 'pokemon_species_names.csv', 'pokemon_types.csv',
    'types.csv', 'type_names.csv', 'abilities.csv', 'ability_names.csv', 'pokemon_abilities.csv',
    'pokemon_stats.csv', 'stats.csv', 'pokemon_species.csv', 'encounters.csv', 'versions.csv',
    'version_names.csv', 'version_groups.csv', 'location_areas.csv', 'location_names.csv',
    'locations.csv', 'encounter_slots.csv', 'encounter_methods.csv'
]

MAIN_GROUPS = {
    'red-blue','yellow','gold-silver','crystal','ruby-sapphire','emerald','firered-leafgreen',
    'diamond-pearl','platinum','heartgold-soulsilver','black-white','black-2-white-2','x-y',
    'omega-ruby-alpha-sapphire','sun-moon','ultra-sun-ultra-moon','lets-go-pikachu-lets-go-eevee',
    'sword-shield','brilliant-diamond-and-shining-pearl','legends-arceus','scarlet-violet'
}
SPECIAL_MAP = {
    'poke-radar': '포켓트레', 'slot2': 'GBA 슬롯 장착', 'swarm': '대량발생',
    'radio-hoenn': '호연 사운드', 'radio-sinnoh': '신오 사운드'
}


def fetch(name):
    with urlopen(BASE + name) as res:
        return list(csv.DictReader(io.StringIO(res.read().decode('utf-8'))))


def ko_name(rows, id_key, value_key='name'):
    out = {}
    for r in rows:
        if int(r['local_language_id']) == 3:
            out[int(r[id_key])] = r[value_key]
    return out


def normalize():
    raw = {name: fetch(name) for name in FILES}
    species = {int(r['id']): r for r in raw['pokemon_species.csv']}
    pokemon = {int(r['id']): r for r in raw['pokemon.csv']}
    p_ko = ko_name(raw['pokemon_species_names.csv'], 'pokemon_species_id')

    type_ko = ko_name(raw['type_names.csv'], 'type_id')
    ability_ko = ko_name(raw['ability_names.csv'], 'ability_id')

    stat_order = {'hp':'hp','attack':'atk','defense':'def','special-attack':'spa','special-defense':'spd','speed':'spe'}
    stat_id_to_key = {int(r['id']): stat_order.get(r['identifier']) for r in raw['stats.csv']}

    p_types = defaultdict(list)
    for r in raw['pokemon_types.csv']:
        p_types[int(r['pokemon_id'])].append(type_ko.get(int(r['type_id']), '알수없음'))

    p_abilities = defaultdict(list)
    for r in raw['pokemon_abilities.csv']:
        p_abilities[int(r['pokemon_id'])].append(ability_ko.get(int(r['ability_id']), '알수없음'))

    p_stats = defaultdict(dict)
    for r in raw['pokemon_stats.csv']:
        key = stat_id_to_key.get(int(r['stat_id']))
        if key:
            p_stats[int(r['pokemon_id'])][key] = int(r['base_stat'])

    groups = {int(r['id']): r for r in raw['version_groups.csv']}
    versions = {int(r['id']): r for r in raw['versions.csv']}
    ver_name_ko = ko_name(raw['version_names.csv'], 'version_id')

    group_versions = defaultdict(list)
    for v in raw['versions.csv']:
        gid = int(v['version_group_id'])
        if groups[gid]['identifier'] in MAIN_GROUPS:
            group_versions[gid].append({
                'gameId': v['identifier'], 'label': ver_name_ko.get(int(v['id']), v['identifier'])
            })

    pokedex = {'schemaVersion': 1, 'locale': 'ko-KR', 'games': [], 'pokemon': []}
    for gid, g in groups.items():
        if g['identifier'] in MAIN_GROUPS:
            pokedex['games'].append({
                'versionGroupId': g['identifier'],
                'label': g['identifier'],
                'generation': int(g['generation_id']),
                'versions': group_versions.get(gid, [])
            })

    for sid, s in species.items():
        if sid not in pokemon:
            continue
        pokedex['pokemon'].append({
            'dexNo': sid,
            'nameKo': p_ko.get(sid, pokemon[sid]['identifier']),
            'gen': int(s['generation_id']),
            'types': p_types.get(sid, []),
            'abilities': p_abilities.get(sid, []),
            'heightM': int(pokemon[sid]['height']) / 10,
            'weightKg': int(pokemon[sid]['weight']) / 10,
            'baseStats': p_stats.get(sid, {}),
            'evolution': {'prev': None, 'next': [], 'chain': [], 'forms': []}
        })

    encounters = {'schemaVersion': 1, 'locale': 'ko-KR', 'encounters': defaultdict(lambda: {'versionGroups': {}})}
    area_to_loc = {int(r['id']): int(r['location_id']) for r in raw['location_areas.csv']}
    loc_ko = ko_name(raw['location_names.csv'], 'location_id')
    slot_method = {int(r['id']): int(r['encounter_method_id']) for r in raw['encounter_slots.csv']}
    method_name = {int(r['id']): r['identifier'] for r in raw['encounter_methods.csv']}

    for e in raw['encounters.csv']:
        pid = int(e['pokemon_id'])
        vid = int(e['version_id'])
        ver = versions[vid]
        gid = int(ver['version_group_id'])
        group_id = groups[gid]['identifier']
        if group_id not in MAIN_GROUPS:
            continue

        if group_id not in encounters['encounters'][str(pid)]['versionGroups']:
            encounters['encounters'][str(pid)]['versionGroups'][group_id] = {'status': 'available', 'versions': {}}

        row = encounters['encounters'][str(pid)]['versionGroups'][group_id]['versions'].setdefault(
            ver['identifier'], {'status': 'available', 'locations': [], 'specialMethods': []}
        )

        loc = loc_ko.get(area_to_loc.get(int(e['location_area_id'])), '미확인')
        if loc not in row['locations']:
            row['locations'].append(loc)

        method = method_name.get(slot_method.get(int(e['encounter_slot_id'])), 'unknown')
        for key, label in SPECIAL_MAP.items():
            if key in method and label not in row['specialMethods']:
                row['specialMethods'].append(label)

    encounters['encounters'] = dict(encounters['encounters'])

    (OUT / 'pokedex.json').write_text(json.dumps(pokedex, ensure_ascii=False), encoding='utf-8')
    (OUT / 'encounters.json').write_text(json.dumps(encounters, ensure_ascii=False), encoding='utf-8')
    print('generated:', len(pokedex['pokemon']), 'pokemon')


if __name__ == '__main__':
    normalize()
