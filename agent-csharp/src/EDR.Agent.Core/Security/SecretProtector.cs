using System.Security.Cryptography;
using System.Text;

namespace EDR.Agent.Core.Security;

/// <summary>
/// Windows DPAPI protection for agent secrets (CurrentUser scope).
/// </summary>
public static class SecretProtector
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("IronShield.EDR.Agent.v1");

    public static string? Protect(string? plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return null;
        var data = Encoding.UTF8.GetBytes(plaintext);
        var protectedBytes = ProtectedData.Protect(data, Entropy, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(protectedBytes);
    }

    public static string? Unprotect(string? protectedBase64)
    {
        if (string.IsNullOrWhiteSpace(protectedBase64)) return null;
        try
        {
            var protectedBytes = Convert.FromBase64String(protectedBase64);
            var data = ProtectedData.Unprotect(protectedBytes, Entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(data);
        }
        catch
        {
            return null;
        }
    }
}
