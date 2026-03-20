using System.Runtime.InteropServices;

namespace EDR.Agent.Core.Antivirus;

/// <summary>
/// Lightweight PE metadata reader for detection detail.
/// Defensive only - reads header info for reporting.
/// </summary>
public static class PeMetadataReader
{
    public class PeInfo
    {
        public string? MachineType { get; set; }
        public List<string> SectionNames { get; set; } = [];
        public DateTime? Timestamp { get; set; }
        public List<string> ImportedDlls { get; set; } = [];
        public uint? EntryPointRva { get; set; }
        public bool HasSuspiciousImports { get; set; }
    }

    private static readonly Dictionary<ushort, string> MachineTypes = new()
    {
        [0x14c] = "i386",
        [0x8664] = "x64",
        [0x1c4] = "ARM",
        [0xaa64] = "ARM64",
    };

    public static PeInfo? TryRead(string filePath)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return null;
        try
        {
            using var fs = File.OpenRead(filePath);
            var buf = new byte[Math.Min(4096, fs.Length)];
            if (fs.Read(buf, 0, buf.Length) < 64) return null;

            var peOffset = BitConverter.ToInt32(buf, 0x3C);
            if (peOffset < 0 || peOffset + 24 >= buf.Length) return null;
            if (buf[peOffset] != 'P' || buf[peOffset + 1] != 'E') return null;

            var info = new PeInfo();

            var machine = BitConverter.ToUInt16(buf, peOffset + 4);
            info.MachineType = MachineTypes.GetValueOrDefault(machine, $"0x{machine:X}");

            var timestamp = BitConverter.ToUInt32(buf, peOffset + 8);
            if (timestamp > 0)
            {
                try
                {
                    info.Timestamp = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime;
                }
                catch { }
            }

            var numSections = BitConverter.ToUInt16(buf, peOffset + 6);
            var optHeaderSize = BitConverter.ToUInt16(buf, peOffset + 20);
            var sectionTableOffset = peOffset + 24 + optHeaderSize;

            for (var i = 0; i < numSections && sectionTableOffset + 40 * (i + 1) <= buf.Length; i++)
            {
                var secStart = sectionTableOffset + 40 * i;
                var nameBytes = new byte[8];
                Array.Copy(buf, secStart, nameBytes, 0, 8);
                var name = System.Text.Encoding.ASCII.GetString(nameBytes).TrimEnd('\0');
                if (!string.IsNullOrEmpty(name))
                    info.SectionNames.Add(name);
            }

            var is64 = machine == 0x8664 || machine == 0xaa64;
            var optHeaderStart = peOffset + 24;
            var entryRvaOffset = optHeaderStart + 16;
            if (is64) entryRvaOffset += 4;
            if (entryRvaOffset + 4 <= buf.Length)
                info.EntryPointRva = BitConverter.ToUInt32(buf, entryRvaOffset);

            var importDirRvaOffset = optHeaderStart + (is64 ? 112 : 96);
            if (importDirRvaOffset + 8 <= buf.Length)
            {
                var importDirRva = BitConverter.ToUInt32(buf, importDirRvaOffset);
                if (importDirRva > 0)
                    TryReadImports(fs, buf, importDirRva, peOffset, info);
            }

            return info;
        }
        catch
        {
            return null;
        }
    }

    private static void TryReadImports(FileStream fs, byte[] buf, uint importDirRva, int peOffset, PeInfo info)
    {
        try
        {
            var numSections = BitConverter.ToUInt16(buf, peOffset + 6);
            var optHeaderSize = BitConverter.ToUInt16(buf, peOffset + 20);
            var sectionTableOffset = peOffset + 24 + optHeaderSize;
            var is64 = buf[peOffset + 5] == 0x64;

            int RvaToFileOffset(uint rva)
            {
                for (var i = 0; i < numSections && sectionTableOffset + 40 * (i + 1) <= buf.Length; i++)
                {
                    var secStart = sectionTableOffset + 40 * i;
                    var secRva = BitConverter.ToUInt32(buf, secStart + 12);
                    var secSize = BitConverter.ToUInt32(buf, secStart + 16);
                    var secRaw = BitConverter.ToUInt32(buf, secStart + 20);
                    if (rva >= secRva && rva < secRva + secSize)
                        return (int)(secRaw + (rva - secRva));
                }
                return -1;
            }

            var importDirFileOffset = RvaToFileOffset(importDirRva);
            if (importDirFileOffset < 0) return;

            var maxBuf = Math.Max(buf.Length, 8192);
            if (importDirFileOffset + 20 > buf.Length)
            {
                fs.Position = 0;
                var bigBuf = new byte[Math.Min(65536, fs.Length)];
                if (fs.Read(bigBuf, 0, bigBuf.Length) < importDirFileOffset + 20) return;
                buf = bigBuf;
            }

            var iltRva = BitConverter.ToUInt32(buf, importDirFileOffset);
            var nameRva = BitConverter.ToUInt32(buf, importDirFileOffset + 12);
            if (iltRva == 0 || nameRva == 0) return;

            var nameOffset = RvaToFileOffset(nameRva);
            if (nameOffset < 0 || nameOffset + 32 > buf.Length) return;

            var dllNameLen = 0;
            for (var j = nameOffset; j < Math.Min(buf.Length, nameOffset + 256); j++)
            {
                if (buf[j] == 0) { dllNameLen = j - nameOffset; break; }
            }
            if (dllNameLen > 0)
            {
                var dllName = System.Text.Encoding.ASCII.GetString(buf, nameOffset, dllNameLen).ToLowerInvariant();
                if (dllName.EndsWith(".dll") && !info.ImportedDlls.Contains(dllName))
                    info.ImportedDlls.Add(dllName);
            }
        }
        catch { }
    }
}
