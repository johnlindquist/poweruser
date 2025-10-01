#!/bin/bash

# Infinite loop to run dopus with agent-sdk-reference-prompt.md
i=0
while true; do
  echo "Running dopus at $(date)"
  # claude --dangerously-skip-permissions --print < agent-sdk-reference-prompt.md
  
  # Read agent-creator-prompt.md and agent-sdk-reference-prompt.md, then stdout their combined output to "dopex exec"
  cat agent-sdk-reference-prompt.md agent-creator-prompt.md  | codex exec --dangerously-bypass-approvals-and-sandbox -c model_reasoning_effort=high 
  
  echo "Waiting 10 minutes before next run..."
  # stop after 10 runs
  if [ $i -eq 10 ]; then
    break
  fi
#   sleep 600  # 10 minutes = 600 seconds
done
