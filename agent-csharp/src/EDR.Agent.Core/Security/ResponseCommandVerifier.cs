using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EDR.Agent.Core.Models;

namespace EDR.Agent.Core.Security;

/// <summary>
/// Verifies HMAC signatures on server-issued response commands (agent key).
/// </summary>
public static class ResponseCommandVerifier
{
    public static bool TryVerify(
        ResponseAction action,
        long endpointId,
        string agentKey,
        bool requireSigned,
        out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(action.CommandSignature))
        {
            if (requireSigned)
            {
                error = "unsigned_command_rejected";
                return false;
            }
            return true;
        }

        if (string.IsNullOrWhiteSpace(agentKey))
        {
            error = "missing_agent_key";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(action.CommandExpiresAt)
            && DateTime.TryParse(action.CommandExpiresAt, null, System.Globalization.DateTimeStyles.RoundtripKind, out var exp)
            && exp.ToUniversalTime() < DateTime.UtcNow)
        {
            error = "command_expired";
            return false;
        }

        var parametersJson = "{}";
        if (action.Parameters.HasValue)
        {
            var p = action.Parameters.Value;
            parametersJson = p.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => "{}",
                _ => JsonSerializer.Serialize(p),
            };
        }

        var expiresAt = action.CommandExpiresAt ?? "";
        var payload = string.Join(
            "\n",
            action.Id.ToString(),
            endpointId.ToString(),
            action.ActionType ?? "",
            expiresAt,
            parametersJson);

        var expected = HmacSha256Hex(agentKey, payload);
        if (!TimingSafeEqualsHex(expected, action.CommandSignature))
        {
            error = "bad_command_signature";
            return false;
        }

        return true;
    }

    private static string HmacSha256Hex(string secret, string payload)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = h.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static bool TimingSafeEqualsHex(string a, string b)
    {
        try
        {
            var aa = Convert.FromHexString(a.Trim());
            var bb = Convert.FromHexString(b.Trim());
            return aa.Length == bb.Length && CryptographicOperations.FixedTimeEquals(aa, bb);
        }
        catch
        {
            return false;
        }
    }
}
