# Files for this arcade

Game files, firmware and your supplied cover images stay in ignored `private/`. They are not included in the source-only export. Provide all the files that belong to a disc dump together; never rename an unrelated game or BIOS to match these names.

| Game | Already supplied | Still needed |
| --- | --- | --- |
| Ultimate Mortal Kombat 3 (Arcade) | Complete verified rev 1.2 set, packaged as `private/roms/umk3/umk3.zip` | Nothing for the current arcade integration. No PlayStation BIOS is used. Save states are unavailable in the tested core. |
| Need for Speed: High Stakes (PS1 US) | New BIN + matching CUE, boot ID `SLUS_008.26`, installed as `private/roms/nfs/high-stakes.zip`; verified SCPH1001 US BIOS | No additional game/BIOS files for this release. The original Windows EXE is not used. |
| Gran Turismo 2 (PS1 Europe / US) | European Arcade Mode (`SCES_023.80`) now installed as `gt2-arcade.zip`; existing US Simulation Mode v1.2 remains separate | No additional disc is needed for the configured Arcade launch. The two regions/disc modes keep separate save namespaces. Actual multiplayer still needs testing. |
| Gran Turismo 4 (PS2 US) | ISO with boot ID `SCUS_973.28`, referenced privately | Your exact ISO's **PS2 Web Recomp browser build**, including `ps2web.html`, `.js`, `.wasm`, `.data`, and any generated workers/supporting files. WSL2/Linux build tools are still needed; see [GT4.md](GT4.md). The documented upstream runtime does not require a PS2 BIOS. |
| Resident Evil 3: Nemesis (PS1 US) | BIN + matching CUE found in Downloads, boot ID `SLUS_009.23`, installed as `private/roms/re3/re3-nemesis.zip`; shared US BIOS | No additional files for the configured single-player version. Actual verification results are recorded separately. |
| Ace Combat 3: Electrosphere (Europe) | BIN + CUE, `SCES_020.66`, installed as `private/roms/ac3/electrosphere.zip` | No additional files for launch checks. Single player. |
| Ghost in the Shell (Europe) | BIN + CUE, `SCES_010.50`, installed as `private/roms/gits/ghost-in-the-shell.zip` | No additional files for launch checks. Single player. |
| G-Police: Weapons of Justice (Europe) | BIN + CUE, `SCES_016.25`, installed as `private/roms/gpolice2/weapons-of-justice.zip` | No additional files for launch checks. Single player. |

## Shared PlayStation firmware

**Your supplied `SCPH1001.BIN` is valid:** 524,288 bytes, MD5 `924e392ed05558ffdb115408c263dccf`. It is installed as `private/bios/scph1001.bin` and can be shared by the configured US PS1 games. The configured PCSX ReARMed core can also use this retail BIOS for the European discs. Its upstream documentation describes retail BIOS support across regions; this differs from requirements of other PS1 cores. Individual games still need actual gameplay checks.

The project accepts these retail BIOS dumps and checks the exact bytes before marking a game ready:

| Filename | MD5 |
| --- | --- |
| `scph1001.bin` | `924e392ed05558ffdb115408c263dccf` |
| `scph5501.bin` | `490f666e1afb15b7362b406ed1cea246` |
| `scph5502.bin` (Europe, optional) | `32736f17079d0b2b7024407c39bd3050` |

PCSX ReARMed BIOS selection is documented [by Libretro](https://docs.libretro.com/library/pcsx_rearmed/#bios). These checksums are listed in the [official EmulatorJS PlayStation documentation](https://emulatorjs.org/docs/systems/playstation/). Do not rename SCPH1001 to SCPH5501; the app handles both properly.

## Import another PS1 disc once

Keep the CUE beside every BIN track it names. For example:

```powershell
python scripts/setup.py --game nfs --disc "C:\path\Need for Speed - High Stakes.cue"
python scripts/setup.py --game gt2-arcade --disc "C:\path\Gran Turismo 2 (Arcade Mode).cue"
python scripts/setup.py --game ac3 --disc "C:\path\Ace Combat 3.cue"
python scripts/setup.py --game gits --disc "C:\path\Ghost in the Shell.cue"
python scripts/setup.py --game gpolice2 --disc "C:\path\G-Police - Weapons of Justice.cue"
python scripts/setup.py --game re3 --disc "C:\path\Resident Evil 3 - Nemesis (USA).cue"
python scripts/setup.py --bios "C:\path\SCPH1001.BIN"
```

The importer packages each disc privately, preserves track filenames, and refuses to use unknown BIOS bytes. It keeps an existing installed archive; move that archive aside yourself if deliberately replacing it. PBP files can instead be copied as `private/roms/nfs/high-stakes.pbp` or `private/roms/gt2/gt2-arcade.pbp`. The pinned PCSX build does not advertise CHD, so use the formats above.

Resident Evil 3 can alternatively use `private/roms/re3/re3-nemesis.pbp`. It is the original PS1 game, not the modern PC remake, and has no local two-player mode. Your supplied Nemesis cover is installed unchanged at `private/covers/re3.png`; source-only copies keep the original SVG illustration.

## Other games later

Send the exact title, platform and region along with the corresponding files. Another arcade game needs the complete ROM ZIP compatible with its chosen core. Another PS1 game needs its whole disc image (CUE + BIN tracks or supported PBP), using the appropriate region firmware. Another PS2 title needs an ISO and a successful per-game recompilation; the experimental runtime may not support it yet. Each new title also needs a library entry, an appropriate core/build, controls and real gameplay checks. Simply adding files does not establish support.

## Supplied covers

Your five exact PNGs are installed under `private/covers/{umk3,nfs,gt2,gt4,re3}.png`. No pixels were altered. The library uses them with a blurred backdrop to preserve the complete cover, even when shapes differ. The UMK3 artwork has a PS2 banner and the NFS artwork includes customized imagery; these are displayed as **user-supplied covers**, with accurate game/platform badges. They do not change the emulated editions. A source-only checkout uses the original SVG fallbacks.


## Added European discs and original covers

The supplied four European CUE/BIN pairs have valid ISO9660 descriptors, whole 2352-byte sectors and the boot IDs recorded above. Their stored ZIPs preserve the original CUE and BIN names/bytes; full archive CRC checks pass. RE3 was already installed from the exact same supplied folder and was kept, not duplicated or replaced.

The three new original PAL front-cover scans are stored privately as `ac3.jpg`, `gits.jpg` and `gpolice2.jpg`. See [COVERS.md](COVERS.md) for source galleries, dimensions and hashes. Existing five covers are untouched. PNG/JPEG lookup uses explicit game IDs and correct MIME types. The source-only edition uses an original generic illustration when private artwork is absent.

Some PAL releases need a matching `.sbi` subchannel file as explained in [PCSX ReARMed's documentation](https://docs.libretro.com/library/pcsx_rearmed/#playing-pal-copy-protected-games). The importer now includes an already supplied SBI beside its matching CUE. It never downloads or synthesizes one. None accompanied these four dumps. A title screen alone does not establish full compatibility; see [VERIFICATION.md](VERIFICATION.md).
