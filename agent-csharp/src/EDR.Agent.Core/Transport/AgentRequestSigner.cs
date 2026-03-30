using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

namespace EDR.Agent.Core.Transport;

internal static class AgentRequestSigner
{
    public static void SignRequest(HttpRequestMessage request, string agentKey, string? jsonBody)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var nonce = Guid.NewGuid().ToString("N");
        var bodyHash = Sha256Hex(jsonBody ?? string.Empty);
        var pathAndQuery = request.RequestUri?.PathAndQuery ?? "/";
        var payload = $"{request.Method.Method}\n{pathAndQuery}\n{timestamp}\n{nonce}\n{bodyHash}";
        var signature = HmacSha256Hex(agentKey, payload);

        request.Headers.Remove("X-Agent-Timestamp");
        request.Headers.Remove("X-Agent-Nonce");
        request.Headers.Remove("X-Agent-Body-Sha256");
        request.Headers.Remove("X-Agent-Signature");
        request.Headers.Add("X-Agent-Timestamp", timestamp);
        request.Headers.Add("X-Agent-Nonce", nonce);
        request.Headers.Add("X-Agent-Body-Sha256", bodyHash);
        request.Headers.Add("X-Agent-Signature", signature);
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string HmacSha256Hex(string secret, string input)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var bytes = h.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
