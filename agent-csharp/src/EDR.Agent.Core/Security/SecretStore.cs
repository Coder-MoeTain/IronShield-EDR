namespace EDR.Agent.Core.Security;

/// <summary>
/// Windows DPAPI-backed secret store for agent credentials (wraps SecretProtector).
/// </summary>
public static class SecretStore
{
    public static string? Protect(string? plaintext) => SecretProtector.Protect(plaintext);

    public static string? Unprotect(string? protectedValue) => SecretProtector.Unprotect(protectedValue);

    public static string ProtectPrefixed(string plaintext) => $"dpapi:{Protect(plaintext)}";

    public static string? UnprotectPrefixed(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        if (!value.StartsWith("dpapi:", StringComparison.OrdinalIgnoreCase)) return value;
        return Unprotect(value["dpapi:".Length..]);
    }
}
