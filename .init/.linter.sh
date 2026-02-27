#!/bin/bash
cd /home/kavia/workspace/code-generation/classic-ludo-play-1101-1116/ludo_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

