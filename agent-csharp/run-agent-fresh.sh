#!/bin/bash
# Run agent after endpoint was deleted - clears stored key so agent re-registers
# Usage: ./run-agent-fresh.sh

CONFIG="src/EDR.Agent.Service/bin/Debug/net8.0/config.json"
if [ -f "$CONFIG" ]; then
  # Remove AgentKey line (works with or without trailing comma)
  sed -i.bak '/"AgentKey"/d' "$CONFIG" 2>/dev/null || sed -i '' '/"AgentKey"/d' "$CONFIG" 2>/dev/null
  echo "[OK] Cleared AgentKey - agent will re-register"
fi

dotnet run --project src/EDR.Agent.Service -- --console
