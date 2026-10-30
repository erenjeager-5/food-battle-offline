'use strict';
// Frida script: save the game's DECRYPTED assemblies as Mono receives them.
//
// The three game assemblies ship encrypted; libfff_.so decrypts them in memory
// just before Mono loads them through mono_image_open_from_data_with_name.
// This hook writes each decrypted image to the app's external files folder:
//   /sdcard/Android/data/com.smosh.foodbattle/files/dec_<name>.dll
//
// Usage (see docs/BUILDING.md), with the ORIGINAL game installed:
//   frida -U -f com.smosh.foodbattle -l dump_assemblies.js
// then pull the three dec_*.dll files with adb.

var OUT = '/sdcard/Android/data/com.smosh.foodbattle/files/';
var WANT = {
    2300928: 'Assembly-CSharp.dll',
    43520: 'Assembly-CSharp-firstpass.dll',
    3072: 'Assembly-UnityScript.dll'
};
var saved = {};
var installed = false;

function install() {
    if (installed) return;
    var addr = Module.findExportByName('libmono.so', 'mono_image_open_from_data_with_name');
    if (!addr) return;
    installed = true;
    Interceptor.attach(addr, {
        onEnter: function (args) {
            var len = args[1].toInt32();
            var name = WANT[len];
            if (!name || saved[name]) return;
            if (args[0].readU16() !== 0x5a4d) return; // only decrypted PE images ("MZ")
            saved[name] = true;
            var f = new File(OUT + 'dec_' + name, 'wb');
            f.write(args[0].readByteArray(len));
            f.close();
            console.log('[+] saved ' + OUT + 'dec_' + name);
        }
    });
    console.log('[+] hook installed - waiting for the game to load its code');
}

install();
var poll = setInterval(function () { install(); if (installed) clearInterval(poll); }, 20);
