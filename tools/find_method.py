#!/usr/bin/env python3
"""Print the file offset of a method's IL code in a .NET assembly.

Patch offsets in patches/fixes.js are the "code" values this prints.

Usage: python find_method.py Assembly-CSharp.dll Type.Method [Type.Method ...]
Requires: pip install dnfile
"""
import sys
import dnfile


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    pe = dnfile.dnPE(sys.argv[1])
    data = pe.__data__
    want = set(sys.argv[2:])
    for t in pe.net.mdtables.TypeDef.rows:
        for m in t.MethodList:
            key = f"{t.TypeName}.{m.row.Name}"
            if key not in want or not m.row.Rva:
                continue
            body = pe.get_offset_from_rva(m.row.Rva)
            if data[body] & 3 == 2:  # tiny header
                hdr, size = 1, data[body] >> 2
            else:  # fat header
                hdr = (int.from_bytes(data[body:body + 2], "little") >> 12) * 4
                size = int.from_bytes(data[body + 4:body + 8], "little")
            print(f"{key}  token=0x{0x06000000 + m.row_index:08x}  code=0x{body + hdr:x}  size={size}")


if __name__ == "__main__":
    main()
