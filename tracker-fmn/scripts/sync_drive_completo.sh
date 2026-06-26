#!/bin/bash
# Organiza arquivos soltos e sincroniza Drive → Supabase
cd /Users/ferreiraemaciel/Documents/fluxo-criativo/tracker-fmn
python3 scripts/drive_organizar.py >> /tmp/tracker-drive-sync.log 2>&1
python3 scripts/sync_drive.py     >> /tmp/tracker-drive-sync.log 2>&1
