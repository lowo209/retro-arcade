"""Install only user-supplied local files. No network downloads or native games."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import zipfile
import zlib

ROOT = Path(__file__).resolve().parent.parent
# UMK3 rev 1.2 metadata from the MAME 2003 Plus midwunit driver.
# Source names may differ; only identical CRC + size are accepted (no game patches).
ROM_SET = {
    'umk3-u2.bin': '3838cfe5', 'umk3-u3.bin': '856fe411',
    'umk3-u4.bin': '428a406f', 'umk3-u5.bin': '3b98a09f',
    'um312u54.bin': '712b4db6', 'um312u63.bin': '6d301faf',
    'umk-u133.bin': '79b94667', 'umk-u132.bin': '13e95228',
    'umk-u131.bin': '41001e30', 'umk-u130.bin': '49379dd7',
    'umk-u129.bin': 'a8b41803', 'umk-u128.bin': 'b410d72f',
    'umk-u127.bin': 'bd985be7', 'umk-u126.bin': 'e7c32cf4',
    'umk-u125.bin': '9a52227e', 'umk-u124.bin': '5c750ebc',
    'umk-u123.bin': 'f0ab88a8', 'umk-u122.bin': '9b87cdac',
    'umk-u121.bin': 'cc4b95db', 'umk-u120.bin': '1c8144cd',
    'umk-u119.bin': '5f10c543', 'umk-u118.bin': 'de0c4488',
    'umk-u113.bin': '99d74a1e', 'umk-u112.bin': 'b5a46488',
    'umk-u111.bin': 'a87523c8', 'umk-u110.bin': '0038f205',
}
BIOS_CHECKSUMS = {
    'scph5501.bin': '490f666e1afb15b7362b406ed1cea246',
    'scph1001.bin': '924e392ed05558ffdb115408c263dccf',
    'scph5502.bin': '32736f17079d0b2b7024407c39bd3050',
}
DISC_TARGETS = {
    'nfs': 'private/roms/nfs/high-stakes.zip',
    'gt2-arcade': 'private/roms/gt2/gt2-arcade.zip',
    'gt2-simulation': 'private/roms/gt2/gt2-simulation.zip',
    're3': 'private/roms/re3/re3-nemesis.zip',
    'ac3': 'private/roms/ac3/electrosphere.zip',
    'gits': 'private/roms/gits/ghost-in-the-shell.zip',
    'gpolice2': 'private/roms/gpolice2/weapons-of-justice.zip',
    'mk4': 'private/roms/mk4/mortal-kombat-4.zip',
    'sh': 'private/roms/sh/silent-hill.zip',
    'tekken3': 'private/roms/tekken3/tekken-3.zip',
    'ctr': 'private/roms/ctr/crash-team-racing.zip',
}


def install_bios(file):
    data = file.read_bytes()
    checksum = hashlib.md5(data).hexdigest()
    name = next((name for name, expected in BIOS_CHECKSUMS.items() if expected == checksum), None)
    if len(data) != 524288 or not name:
        raise ValueError('Unsupported retail PS1 BIOS checksum: ' + file.name)
    target = ROOT / 'private/bios' / name
    if target.exists() and hashlib.md5(target.read_bytes()).hexdigest() != checksum:
        raise ValueError('An incompatible BIOS already exists at ' + str(target) + '. Move it aside first.')
    if not target.exists():
        shutil.copy2(file, target)
    print('Retail PS1 BIOS verified and installed: ' + name)


def package_umk(files):
    candidates = [p for p in files if p.suffix.lower() == '.bin' and p.stat().st_size in (524288, 1048576) and ('umk' in p.name.lower() or 'mk3' in p.name.lower() or 'um312' in p.name.lower())]
    by_crc = {format(zlib.crc32(p.read_bytes()) & 0xffffffff, '08x'): p for p in candidates}
    missing = [name for name, crc in ROM_SET.items() if crc not in by_crc]
    if missing:
        print('UMK3 not imported: missing or incompatible files: ' + ', '.join(missing))
        return
    target = ROOT / 'private/roms/umk3/umk3.zip'
    if target.exists():
        with zipfile.ZipFile(target) as archive:
            if all(name in archive.namelist() and format(archive.getinfo(name).CRC, '08x') == crc for name, crc in ROM_SET.items()):
                print('UMK3: existing archive checksums OK.')
                return
        raise ValueError('Existing UMK3 archive does not match. Move it aside before retrying.')
    temporary = target.with_suffix('.zip.partial')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        for name, crc in ROM_SET.items():
            p = by_crc[crc]
            expected_size = 524288 if name.startswith('um312') else 1048576
            if p.stat().st_size != expected_size:
                raise ValueError('Unexpected ROM size: ' + p.name)
            archive.write(p, name)
    temporary.replace(target)
    print('UMK3: 26 original ROM parts verified and packaged locally.')


def package_disc(cue, target, replace=False):
    if target.exists() and not replace:
        print(target.name + ': already installed; kept existing file.')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    text = cue.read_text(encoding='utf-8-sig')
    names = re.findall(r'^\s*FILE\s+"([^"]+)"', text, re.IGNORECASE | re.MULTILINE)
    if not names:
        raise ValueError('No quoted FILE entries found in ' + cue.name)
    tracks = []
    for name in names:
        track = (cue.parent / name).resolve()
        if track.parent != cue.parent.resolve() or not track.is_file():
            raise ValueError('CUE track must exist beside its CUE: ' + name)
        tracks.append(track)
    temporary = target.with_suffix('.zip.partial')
    # Stored ZIP avoids a long compression step for large disc images.
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_STORED) as archive:
        archive.write(cue, cue.name)
        for track in dict.fromkeys(tracks):
            archive.write(track, track.name)
        # Preserve a user-supplied matching subchannel file for PAL discs.
        # Never fetch or synthesize it. It must stay beside this exact dump.
        sbi = next((p for p in cue.parent.iterdir() if p.stem.lower() == cue.stem.lower() and p.suffix.lower() == '.sbi'), None)
        if sbi:
            if not sbi.is_file() or sbi.resolve().parent != cue.parent.resolve():
                raise ValueError('SBI must exist beside its matching CUE.')
            archive.write(sbi, sbi.name)
    temporary.replace(target)
    print(target.name + ': installed CUE and all tracks in private storage.')


def install_runtime(source):
    candidates = [p.parent for p in source.glob('*/data/loader.js')]
    if (source / 'data/loader.js').is_file():
        candidates.insert(0, source / 'data')
    if not candidates:
        print('EmulatorJS not found: provide an extracted official 4.2.3 release folder.')
        return
    data = candidates[0]
    if json.loads((data / 'version.json').read_text()).get('version') != '4.2.3':
        raise ValueError('This integration is pinned to EmulatorJS 4.2.3. Use that release.')
    dest = ROOT / 'vendor/emulatorjs/data'
    dest.mkdir(parents=True, exist_ok=True)
    for child in data.iterdir():
        if child.name == 'cores':
            continue
        if child.is_dir():
            shutil.copytree(child, dest / child.name, dirs_exist_ok=True)
        else:
            shutil.copy2(child, dest / child.name)
    # 4.2.3 checks a CDN on localhost without catching offline fetch errors.
    # Disable just that optional invocation in BOTH installed source and minified
    # output. Keep the patch reproducible here; do not change emulation behavior.
    for relative in ('src/emulator.js', 'emulator.min.js'):
        installed = dest / relative
        code = installed.read_text(encoding='utf-8')
        if code.count('this.checkForUpdates()') != 1:
            raise ValueError('Unexpected 4.2.3 updater code; refusing an ambiguous offline patch.')
        installed.write_text(code.replace('this.checkForUpdates()', 'void 0'), encoding='utf-8')
    cores = dest / 'cores'
    (cores / 'reports').mkdir(parents=True, exist_ok=True)
    for name in ('mame2003_plus', 'pcsx_rearmed'):
        for p in (data / 'cores').glob(name + '-*.data'):
            shutil.copy2(p, cores / p.name)
        shutil.copy2(data / 'cores/reports' / (name + '.json'), cores / 'reports' / (name + '.json'))
    for name in ('cores.json', 'core-README.md'):
        if (data / 'cores' / name).is_file():
            shutil.copy2(data / 'cores' / name, cores / name)
    # Retain upstream license and available sources beside the runtime.
    for name in ('LICENSE', 'README.md', 'package.json', 'CHANGES.md'):
        if (data.parent / name).is_file():
            shutil.copy2(data.parent / name, dest.parent / name)
    print('EmulatorJS 4.2.3: local runtime, sources, licenses and two cores installed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path.home() / 'Downloads/Retro Games')
    parser.add_argument('--disc', type=Path, help='Import one CUE and its referenced BIN tracks.')
    parser.add_argument('--game', choices=tuple(DISC_TARGETS))
    parser.add_argument('--replace-disc', action='store_true', help='Deliberately rebuild the selected installed disc ZIP from --disc and its matching tracks/SBI.')
    parser.add_argument('--bios', type=Path, help='Import a checksum-verified retail PS1 BIOS.')
    args = parser.parse_args()
    for directory in ('private/roms/umk3', 'private/roms/nfs', 'private/roms/gt2', 'private/roms/re3', 'private/roms/ac3', 'private/roms/gits', 'private/roms/gpolice2', 'private/bios', 'private/gt4/web'):
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    if bool(args.disc) != bool(args.game):
        raise ValueError('--disc and --game must be used together.')
    if args.replace_disc and not args.disc:
        raise ValueError('--replace-disc requires --disc and --game; automatic setup never replaces installed discs.')
    if args.disc or args.bios:
        if args.bios:
            install_bios(args.bios.resolve())
        if args.disc:
            cue = args.disc.resolve()
            if cue.suffix.lower() != '.cue' or not cue.is_file():
                raise ValueError('--disc needs an existing .cue file beside its BIN tracks.')
            target = DISC_TARGETS[args.game]
            package_disc(cue, ROOT / target, replace=args.replace_disc)
        print('Local import complete. Recheck the library or run npm start.')
        return
    source = args.source.resolve()
    if not source.is_dir():
        raise ValueError('Source folder not found: ' + str(source))
    if source == ROOT or ROOT in source.parents or source in ROOT.parents:
        raise ValueError('Choose a separate source folder, not the project or one of its parents.')
    for directory in ('private/roms/umk3', 'private/roms/nfs', 'private/roms/gt2', 'private/roms/re3', 'private/roms/ac3', 'private/roms/gits', 'private/roms/gpolice2', 'private/bios', 'private/gt4/web'):
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    install_runtime(source)
    files = [p for p in source.rglob('*') if p.is_file() and '4.2.3' not in p.relative_to(source).parts]
    package_umk(files)
    for cue in [p for p in files if p.suffix.lower() == '.cue']:
        name = cue.name.lower()
        if 'gran turismo 2' in name:
            variant = 'arcade' if 'arcade' in name else 'simulation' if 'simulation' in name else None
            if variant:
                package_disc(cue, ROOT / f'private/roms/gt2/gt2-{variant}.zip')
        elif 'high stakes' in name or 'road challenge' in name:
            package_disc(cue, ROOT / 'private/roms/nfs/high-stakes.zip')
        elif 'resident evil 3' in name and 'nemesis' in name:
            package_disc(cue, ROOT / 'private/roms/re3/re3-nemesis.zip')
        elif 'ace combat 3' in name:
            package_disc(cue, ROOT / DISC_TARGETS['ac3'])
        elif 'ghost in the shell' in name:
            package_disc(cue, ROOT / DISC_TARGETS['gits'])
        elif 'g-police' in name and 'weapons of justice' in name:
            package_disc(cue, ROOT / DISC_TARGETS['gpolice2'])
        elif 'mortal kombat 4' in name:
            package_disc(cue, ROOT / DISC_TARGETS['mk4'])
        elif 'silent hill' in name:
            package_disc(cue, ROOT / DISC_TARGETS['sh'])
        elif 'tekken 3' in name:
            package_disc(cue, ROOT / DISC_TARGETS['tekken3'])
        elif 'crash team racing' in name:
            package_disc(cue, ROOT / DISC_TARGETS['ctr'])
    for bios in [p for p in files if p.name.lower() in BIOS_CHECKSUMS]:
        install_bios(bios)
    local_file = ROOT / 'private/local.json'
    local = json.loads(local_file.read_text()) if local_file.exists() else {}
    iso = next((p for p in files if p.suffix.lower() == '.iso' and 'gran turismo 4' in p.name.lower()), None)
    if iso and not local.get('gt4'):
        local['gt4'] = {'disc': str(iso), 'buildDirectory': 'private/gt4/web'}
        print('GT4: existing ISO referenced privately (not copied). Browser build still needed.')
    local_file.write_text(json.dumps(local, indent=2), encoding='utf-8')
    print('Setup complete. No native executables launched and no game files downloaded. Run npm start.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print('Setup stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
