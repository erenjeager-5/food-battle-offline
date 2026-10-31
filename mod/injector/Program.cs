// Wires FoodBattleOffline.dll into an already byte-patched Assembly-CSharp.dll.
// usage: injector <Assembly-CSharp.dll in> <FoodBattleOffline.dll> <Assembly-CSharp.dll out>
using System;
using System.IO;
using System.Linq;
using Mono.Cecil;
using Mono.Cecil.Cil;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length != 3)
        {
            Console.Error.WriteLine("usage: injector <Assembly-CSharp.dll> <FoodBattleOffline.dll> <out.dll>");
            return 1;
        }
        var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(Path.GetDirectoryName(Path.GetFullPath(args[0])));
        resolver.AddSearchDirectory(Path.GetDirectoryName(Path.GetFullPath(args[1])));
        var rp = new ReaderParameters { AssemblyResolver = resolver, ReadingMode = ReadingMode.Immediate };
        var game = AssemblyDefinition.ReadAssembly(args[0], rp);
        var helperAsm = AssemblyDefinition.ReadAssembly(args[1], rp);
        var module = game.MainModule;
        var helper = helperAsm.MainModule.GetType("FoodBattleOffline");
        MethodReference H(string name) => module.ImportReference(helper.Methods.Single(m => m.Name == name));

        var store = module.GetType("StevieStoreScreen");
        var iap = module.GetType("UIStoreIAP");
        var listable = module.GetType("UIListableObject");
        var iapData = iap.Fields.Single(f => f.Name == "m_iapData");
        var purchaseType = module.GetType("IAPFoodPurchase");

        // 1. StevieStoreScreen.CheckForOnline(view) => FoodBattleOffline.CheckForOnline(this, view)
        {
            var m = store.Methods.Single(x => x.Name == "CheckForOnline");
            m.Body.Instructions.Clear();
            m.Body.ExceptionHandlers.Clear();
            m.Body.Variables.Clear();
            var il = m.Body.GetILProcessor();
            il.Emit(OpCodes.Ldarg_0);
            il.Emit(OpCodes.Ldarg_1);
            il.Emit(OpCodes.Call, H("CheckForOnline"));
            il.Emit(OpCodes.Ret);
        }

        // 2. UIStoreIAP.Populate prologue:
        //    if (FoodBattleOffline.IsOfflineCrystalPack(occupant)) {
        //        base.Populate(occupant, panel); m_iapData = (IAPFoodPurchase)occupant;
        //        FoodBattleOffline.FillOfflineCrystalPack(this, occupant); return; }
        {
            var m = iap.Methods.Single(x => x.Name == "Populate");
            var basePopulate = module.ImportReference(listable.Methods.Single(x => x.Name == "Populate"));
            var il = m.Body.GetILProcessor();
            var first = m.Body.Instructions[0];
            var seq = new[]
            {
                il.Create(OpCodes.Ldarg_1),
                il.Create(OpCodes.Call, H("IsOfflineCrystalPack")),
                il.Create(OpCodes.Brfalse, first),
                il.Create(OpCodes.Ldarg_0),
                il.Create(OpCodes.Ldarg_1),
                il.Create(OpCodes.Ldarg_2),
                il.Create(OpCodes.Call, basePopulate),
                il.Create(OpCodes.Ldarg_0),
                il.Create(OpCodes.Ldarg_1),
                il.Create(OpCodes.Castclass, purchaseType),
                il.Create(OpCodes.Stfld, iapData),
                il.Create(OpCodes.Ldarg_0),
                il.Create(OpCodes.Ldarg_1),
                il.Create(OpCodes.Call, H("FillOfflineCrystalPack")),
                il.Create(OpCodes.Ret),
            };
            foreach (var ins in seq.Reverse())
            {
                il.InsertBefore(m.Body.Instructions[0], ins);
            }
        }

        // 3. UIStoreIAP.Handle_BuyClicked prologue:
        //    if (FoodBattleOffline.TryBuyWithCoins(this, m_iapData)) return;
        {
            var m = iap.Methods.Single(x => x.Name == "Handle_BuyClicked");
            var il = m.Body.GetILProcessor();
            var first = m.Body.Instructions[0];
            var seq = new[]
            {
                il.Create(OpCodes.Ldarg_0),
                il.Create(OpCodes.Ldarg_0),
                il.Create(OpCodes.Ldfld, iapData),
                il.Create(OpCodes.Call, H("TryBuyWithCoins")),
                il.Create(OpCodes.Brfalse, first),
                il.Create(OpCodes.Ret),
            };
            foreach (var ins in seq.Reverse())
            {
                il.InsertBefore(m.Body.Instructions[0], ins);
            }
        }

        // 4. LocManager.GetLocString: every `return x;` becomes
        //    `return FoodBattleOffline.EnglishFallback(this, id, x);`
        var loc = module.GetType("RHICommon.LocManager");
        if (Environment.GetEnvironmentVariable("FB_TEST_NO_FALLBACK") == null)
        {
            var m = loc.Methods.Single(x => x.Name == "GetLocString");
            var il = m.Body.GetILProcessor();
            var tmp = new VariableDefinition(module.TypeSystem.String);
            m.Body.Variables.Add(tmp);
            foreach (var ret in m.Body.Instructions.Where(i => i.OpCode == OpCodes.Ret).ToList())
            {
                // keep `ret` as the branch target: turn it into the first instruction of the tail
                ret.OpCode = OpCodes.Stloc;
                ret.Operand = tmp;
                var tail = new[]
                {
                    il.Create(OpCodes.Ldarg_0),
                    il.Create(OpCodes.Ldarg_1),
                    il.Create(OpCodes.Ldloc, tmp),
                    il.Create(OpCodes.Call, H("EnglishFallback")),
                    il.Create(OpCodes.Ret),
                };
                var after = ret;
                foreach (var ins in tail)
                {
                    il.InsertAfter(after, ins);
                    after = ins;
                }
            }
            Console.WriteLine("added English fallback to LocManager.GetLocString");
        }

        // Test only: force the game language (e.g. FB_TEST_FORCE_LANGUAGE=6 for Spanish).
        var forced = Environment.GetEnvironmentVariable("FB_TEST_FORCE_LANGUAGE");
        if (forced != null)
        {
            var m = loc.Methods.Single(x => x.Name == "SelectLanguage");
            var il = m.Body.GetILProcessor();
            var first = m.Body.Instructions[0];
            il.InsertBefore(first, il.Create(OpCodes.Ldc_I4, int.Parse(forced)));
            il.InsertBefore(first, il.Create(OpCodes.Starg, m.Parameters[0]));
            Console.WriteLine("TEST BUILD: language forced to " + forced);
        }

        // Byte patches that stub a method with a leading `ret` leave the old IL behind it.
        // That dead IL can decode to garbage tokens, so trim such bodies to the bare `ret`.
        // Same for patches that end in `ret` mid-body: drop what follows the first `ret`
        // when nothing branches past it.
        foreach (var t in module.GetTypes())
            foreach (var m in t.Methods.Where(x => x.HasBody))
            {
                var body = m.Body;
                if (body.Instructions.Count > 1 && body.Instructions[0].OpCode == OpCodes.Ret)
                {
                    body.Instructions.Clear();
                    body.ExceptionHandlers.Clear();
                    body.Variables.Clear();
                    body.GetILProcessor().Emit(OpCodes.Ret);
                    continue;
                }
                if (!body.Instructions.Any(IsBroken))
                    continue;
                var list = body.Instructions;
                int ret = list.ToList().FindIndex(i => i.OpCode == OpCodes.Ret);
                // only branches from live code (up to the ret) matter; the rest is unreachable
                var targets = list.Take(ret + 1).SelectMany(BranchTargets).Select(x => list.IndexOf(x));
                var deadHandlers = body.ExceptionHandlers.Where(h => list.IndexOf(h.TryStart) > ret).ToList();
                if (ret < 0 || targets.Any(x => x > ret) || deadHandlers.Count != body.ExceptionHandlers.Count)
                    throw new Exception($"cannot clean up patched body of {t.FullName}.{m.Name}");
                body.ExceptionHandlers.Clear();
                while (list.Count > ret + 1)
                    list.RemoveAt(list.Count - 1);
                Console.WriteLine($"trimmed dead IL after ret in {t.FullName}.{m.Name}");
            }

        // Long branch forms everywhere, so inserted code never breaks short-branch offsets.
        foreach (var t in new[] { store, iap, loc })
            foreach (var m in t.Methods.Where(x => x.HasBody))
            {
                foreach (var ins in m.Body.Instructions)
                {
                    if (ins.OpCode.OperandType == OperandType.ShortInlineBrTarget)
                        ins.OpCode = LongForm(ins.OpCode);
                }
                m.Body.MaxStackSize = Math.Max(m.Body.MaxStackSize, 8);
            }

        game.Write(args[2]);
        Console.WriteLine("injected crystal exchange into " + args[2]);
        return 0;
    }

    static bool IsBroken(Instruction i)
    {
        switch (i.OpCode.OperandType)
        {
            case OperandType.InlineBrTarget:
            case OperandType.ShortInlineBrTarget:
                return !(i.Operand is Instruction);
            case OperandType.InlineSwitch:
                return !(i.Operand is Instruction[] a) || a.Any(x => x == null);
            case OperandType.InlineVar:
            case OperandType.ShortInlineVar:
                return !(i.Operand is VariableDefinition);
            case OperandType.InlineArg:
            case OperandType.ShortInlineArg:
                return !(i.Operand is ParameterDefinition);
            case OperandType.InlineMethod:
            case OperandType.InlineField:
            case OperandType.InlineType:
            case OperandType.InlineTok:
            case OperandType.InlineString:
                return i.Operand == null;
            default:
                return false;
        }
    }

    static Instruction[] BranchTargets(Instruction i)
    {
        if (i.Operand is Instruction t) return new[] { t };
        if (i.Operand is Instruction[] a) return a.Where(x => x != null).ToArray();
        return Array.Empty<Instruction>();
    }

    static OpCode LongForm(OpCode op)
    {
        if (op == OpCodes.Br_S) return OpCodes.Br;
        if (op == OpCodes.Brfalse_S) return OpCodes.Brfalse;
        if (op == OpCodes.Brtrue_S) return OpCodes.Brtrue;
        if (op == OpCodes.Beq_S) return OpCodes.Beq;
        if (op == OpCodes.Bge_S) return OpCodes.Bge;
        if (op == OpCodes.Bgt_S) return OpCodes.Bgt;
        if (op == OpCodes.Ble_S) return OpCodes.Ble;
        if (op == OpCodes.Blt_S) return OpCodes.Blt;
        if (op == OpCodes.Bne_Un_S) return OpCodes.Bne_Un;
        if (op == OpCodes.Bge_Un_S) return OpCodes.Bge_Un;
        if (op == OpCodes.Bgt_Un_S) return OpCodes.Bgt_Un;
        if (op == OpCodes.Ble_Un_S) return OpCodes.Ble_Un;
        if (op == OpCodes.Blt_Un_S) return OpCodes.Blt_Un;
        if (op == OpCodes.Leave_S) return OpCodes.Leave;
        return op;
    }
}
