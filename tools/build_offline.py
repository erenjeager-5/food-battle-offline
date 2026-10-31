#!/usr/bin/env python3
"""Build a self-contained, offline-playable Food Battle APK from your own copy
of the game (Smosh: Food Battle The Game v1.31, versionCode 20).

Inputs (all from YOUR copy of the game - none are included in this repo):
  --decoded     the original APK decoded with apktool (`apktool d base.apk -o decoded`)
  --obb         the expansion file main.20.com.smosh.foodbattle.obb
  --assemblies  folder with the three DECRYPTED assemblies captured from memory
                (see docs/BUILDING.md and tools/dump_assemblies.js):
                  Assembly-CSharp.dll, Assembly-CSharp-firstpass.dll, Assembly-UnityScript.dll

What it does:
  - writes every patch from patches/fixes.js into the decrypted Assembly-CSharp.dll
  - compiles mod/helper/FoodBattleOffline.cs (crystal exchange, English text fallback)
    and wires it into the game code with mod/injector (Mono.Cecil); needs the .NET 8 SDK
  - ships the decrypted assemblies and removes the decryptor (libfff_.so)
  - removes the x86 engine libs (emulators then use their ARM translator)
  - merges the OBB into the APK and turns Unity's OBB mode off
  - raises targetSdkVersion 21 -> 23 (required to install on Android 14+)
  - rebuilds with apktool, then zipaligns and signs with your keystore

Example:
  python build_offline.py --decoded decoded --obb main.20.com.smosh.foodbattle.obb \
      --assemblies dumps --keystore my.keystore --ks-pass pass:android \
      --apktool apktool.jar --build-tools "%ANDROID_HOME%/build-tools/36.0.0"
"""
import argparse, hashlib, os, re, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FIXES = os.path.join(HERE, "..", "patches", "fixes.js")
MOD = os.path.join(HERE, "..", "mod")
ASSEMBLY_SIZE = 2300928

# SHA-256 of the inputs the patch offsets were made for (game v1.31).
EXPECTED = {
    "Assembly-CSharp.dll": "f52b38288986a0189eec8eba28bd14e69054f9268c7fe1f09a073f9d0c0c5f01",
    "Assembly-CSharp-firstpass.dll": "2adda1c79b6ab8b0915adb8998e8e243b6069ce698c44d8ceb01f49fc4491c23",
    "Assembly-UnityScript.dll": "0f47c209e28a89bf82e97b060111b3d1acc8eccb3d633f833bf053a702eb24fb",
    "obb": "6129bae2f02fc44176ee592722fbbab5f4adfee5c63ee8a8e4ac60d5d3444150",
}

# Patches that only make sense once the OBB data is inside the APK.
EXTRA_PATCHES = [
    # gameLoaderScreenContext.<OBBDownloader>c__Iterator25.MoveNext -> ldc.i4.0; ret
    # (otherwise it calls FetchOBB() and waits forever for Google Play's downloader)
    (0x100000, [0x16, 0x2a], "OBB download check skipped"),
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd):
    print(">", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, shell=(os.name == "nt" and cmd[0].endswith(".bat")))


def parse_fixes(path):
    """Read the (offset, bytes, name) patch list out of patches/fixes.js."""
    js = open(path, encoding="utf-8").read()
    patches = []
    for m in re.finditer(r"^var (PATCH\d*)_OFFSET = (0x[0-9a-fA-F]+|null);", js, re.M):
        if m.group(2) == "null":
            continue
        b = re.search(r"^var %s_BYTES = \[([^\]]*)\];" % m.group(1), js, re.M)
        patches.append((int(m.group(2), 16), [int(x, 16) for x in b.group(1).split(",")], m.group(1)))
    helpers = re.search(r"var ANALYTICS_HELPER_NOOPS = \[(.*?)\n\];", js, re.S).group(1)
    for off, name in re.findall(r"\[(0x[0-9a-fA-F]+), '([^']+)'\]", helpers):
        patches.append((int(off, 16), [0x2a], "FoodBattleAnalytics." + name))
    return patches + EXTRA_PATCHES


def find_csc():
    """The C# compiler that ships with the newest installed .NET SDK."""
    out = subprocess.run(["dotnet", "--list-sdks"], capture_output=True, text=True, check=True).stdout
    sdks = re.findall(r"^(\S+) \[(.+)\]$", out, re.M)
    if not sdks:
        sys.exit("no .NET SDK found - install the .NET 8 SDK (https://dotnet.microsoft.com/download)")
    version, root = max(sdks, key=lambda v: [int(x) if x.isdigit() else 0 for x in re.split(r"[.-]", v[0])])
    csc = os.path.join(root, version, "Roslyn", "bincore", "csc.dll")
    if not os.path.exists(csc):
        sys.exit("csc.dll not found in " + os.path.join(root, version))
    return csc


def add_offline_features(patched_dll, managed, work):
    """Compile the helper library against the game's own Mono 2.0 libraries and inject
    its hooks into the byte-patched Assembly-CSharp.dll. Writes both into Managed/."""
    mod_work = os.path.join(work, "mod")
    os.makedirs(mod_work)
    game_in = os.path.join(mod_work, "Assembly-CSharp.dll")
    open(game_in, "wb").write(patched_dll)
    helper = os.path.join(mod_work, "FoodBattleOffline.dll")
    refs = [os.path.join(managed, n) for n in ("mscorlib.dll", "System.dll", "System.Core.dll", "UnityEngine.dll")]
    run(["dotnet", find_csc(), "-nologo", "-noconfig", "-nostdlib+", "-target:library", "-langversion:3", "-deterministic",
         "-optimize+", "-out:" + helper] + ["-r:" + r for r in refs + [game_in]]
        + [os.path.join(MOD, "helper", "FoodBattleOffline.cs")])
    injector_dir = os.path.join(MOD, "injector")
    run(["dotnet", "build", "-c", "Release", "-o", os.path.join(mod_work, "injector"), injector_dir])
    run(["dotnet", os.path.join(mod_work, "injector", "injector.dll"), game_in, helper,
         os.path.join(managed, "Assembly-CSharp.dll")])
    shutil.copy(helper, os.path.join(managed, "FoodBattleOffline.dll"))


def check_inputs(args):
    ok = True
    for name in ("Assembly-CSharp.dll", "Assembly-CSharp-firstpass.dll", "Assembly-UnityScript.dll"):
        p = os.path.join(args.assemblies, name)
        if not os.path.isfile(p):
            sys.exit(f"missing decrypted assembly: {p}")
        if open(p, "rb").read(2) != b"MZ":
            sys.exit(f"{p} is still encrypted - capture it with tools/dump_assemblies.js")
        if sha256(p) != EXPECTED[name]:
            print(f"WARNING: {name} does not match the known v1.31 file", flush=True)
            ok = False
    if sha256(args.obb) != EXPECTED["obb"]:
        print("WARNING: the OBB does not match the known v1.31 file", flush=True)
        ok = False
    if not ok and not args.force:
        sys.exit("Inputs differ from game v1.31; patch offsets would be wrong. Use --force to build anyway.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--decoded", required=True, help="apktool-decoded original APK folder")
    ap.add_argument("--obb", required=True, help="main.20.com.smosh.foodbattle.obb")
    ap.add_argument("--assemblies", required=True, help="folder with the 3 decrypted assemblies")
    ap.add_argument("--keystore", required=True, help="keystore to sign with")
    ap.add_argument("--ks-pass", default="pass:android", help="apksigner --ks-pass value")
    ap.add_argument("--key-pass", default=None, help="apksigner --key-pass value (defaults to --ks-pass)")
    ap.add_argument("--apktool", default="apktool.jar", help="path to apktool.jar")
    ap.add_argument("--build-tools", required=True, help="Android SDK build-tools folder (zipalign, apksigner)")
    ap.add_argument("--out", default="FoodBattle_Offline.apk")
    ap.add_argument("--work", default="build_offline", help="temporary work folder (deleted afterwards)")
    ap.add_argument("--force", action="store_true", help="build even if inputs don't match v1.31")
    args = ap.parse_args()
    check_inputs(args)

    if os.path.exists(args.work):
        shutil.rmtree(args.work)
    src = os.path.join(args.work, "src")
    shutil.copytree(args.decoded, src, ignore=shutil.ignore_patterns("build"))

    # 1. Remove the decryptor (and a Frida gadget, if a previous build added one).
    for abi in os.listdir(os.path.join(src, "lib")):
        for lib in ("libfff_.so", "libfrida-gadget.so", "libfrida-gadget.config.so"):
            p = os.path.join(src, "lib", abi, lib)
            if os.path.exists(p):
                os.remove(p)
    smali = os.path.join(src, "smali", "com", "unity3d", "player", "UnityPlayerNativeActivity.smali")
    sm = open(smali, encoding="utf-8").read()
    decryptor_call = "    invoke-direct {p0}, Lcom/unity3d/player/UnityPlayerNativeActivity;->fff_()V\n\n"
    assert sm.count(decryptor_call) == 1, "unexpected UnityPlayerNativeActivity.smali - is this v1.31?"
    sm = sm.replace(decryptor_call, "")
    sm = sm.replace('    const-string v0, "frida-gadget"\n\n'
                    '    invoke-static {v0}, Ljava/lang/System;->loadLibrary(Ljava/lang/String;)V\n\n', "")
    open(smali, "w", encoding="utf-8").write(sm)

    # 2. Drop the x86 engine libs: on x86 emulators the x86 Unity 4 player only renders
    #    a black screen; without it they run the ARM build through their translator.
    x86 = os.path.join(src, "lib", "x86")
    if os.path.isdir(x86):
        shutil.rmtree(x86)

    # 3. Ship the decrypted, pre-patched game code.
    managed = os.path.join(src, "assets", "bin", "Data", "Managed")
    dll = bytearray(open(os.path.join(args.assemblies, "Assembly-CSharp.dll"), "rb").read())
    assert len(dll) == ASSEMBLY_SIZE
    patches = parse_fixes(FIXES)
    for off, data, name in patches:
        assert off + len(data) <= len(dll), name
        dll[off:off + len(data)] = bytes(data)
    print(f"applied {len(patches)} patches to Assembly-CSharp.dll", flush=True)
    add_offline_features(bytes(dll), managed, args.work)
    for name in ("Assembly-CSharp-firstpass.dll", "Assembly-UnityScript.dll"):
        shutil.copy(os.path.join(args.assemblies, name), os.path.join(managed, name))

    # 4. Unity: read all data from the APK instead of an OBB.
    settings = os.path.join(src, "assets", "bin", "Data", "settings.xml")
    s = open(settings, encoding="utf-8").read()
    open(settings, "w", encoding="utf-8").write(s.replace('<bool name="useObb">True</bool>', '<bool name="useObb">False</bool>'))

    # 5. targetSdkVersion 21 -> 23 (Android 14+ refuses to install below 23).
    yml = os.path.join(src, "apktool.yml")
    y = open(yml, encoding="utf-8").read()
    open(yml, "w", encoding="utf-8").write(y.replace("targetSdkVersion: 21", "targetSdkVersion: 23"))

    # 6. Rebuild with apktool.
    unsigned = os.path.join(args.work, "unsigned.apk")
    run(["java", "-jar", args.apktool, "b", src, "-o", unsigned])

    # 7. Merge the OBB (keeping each entry's compression; videos stay uncompressed).
    merged = os.path.join(args.work, "merged.apk")
    with zipfile.ZipFile(unsigned) as zin, zipfile.ZipFile(merged, "w") as zout:
        existing = set()
        for info in zin.infolist():
            zout.writestr(info, zin.read(info.filename))
            existing.add(info.filename)
        with zipfile.ZipFile(args.obb) as zobb:
            for info in zobb.infolist():
                if info.filename.endswith("/") or info.filename in existing:
                    continue
                ni = zipfile.ZipInfo(info.filename, info.date_time)
                ni.compress_type = zipfile.ZIP_STORED if info.filename.endswith(".mp4") else info.compress_type
                zout.writestr(ni, zobb.read(info.filename))

    # 8. Align and sign.
    exe = ".exe" if os.name == "nt" else ""
    bat = ".bat" if os.name == "nt" else ""
    aligned = os.path.join(args.work, "aligned.apk")
    run([os.path.join(args.build_tools, "zipalign" + exe), "-f", "-p", "4", merged, aligned])
    run([os.path.join(args.build_tools, "apksigner" + bat), "sign", "--ks", args.keystore,
         "--ks-pass", args.ks_pass, "--key-pass", args.key_pass or args.ks_pass, "--out", args.out, aligned])
    run([os.path.join(args.build_tools, "apksigner" + bat), "verify", args.out])
    shutil.rmtree(args.work)
    if os.path.exists(args.out + ".idsig"):
        os.remove(args.out + ".idsig")
    print("Built", args.out, os.path.getsize(args.out) // (1024 * 1024), "MB")


if __name__ == "__main__":
    main()
