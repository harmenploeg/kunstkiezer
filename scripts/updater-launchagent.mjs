import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const codex=process.env.KUNSTKIEZER_CODEX_BIN;
const node=process.env.KUNSTKIEZER_NODE_BIN||process.execPath;
if(!path.isAbsolute(node))throw new Error('Node-pad moet absoluut zijn');
if(!codex||!path.isAbsolute(codex))throw new Error('Stel KUNSTKIEZER_CODEX_BIN op een absoluut Codex-pad in');
console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>nl.loci.kunstkiezer-updater</string>
<key>ProgramArguments</key><array><string>${escape(node)}</string><string>${escape(path.join(root,'scripts/updater-service.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>StartInterval</key><integer>300</integer>
<key>EnvironmentVariables</key><dict>
<key>KUNSTKIEZER_CODEX_BIN</key><string>${escape(codex)}</string>
<key>KUNSTKIEZER_PROJECT_REF</key><string>qrlfywcqkkzmerglmsbj</string>
<key>PATH</key><string>${escape(path.dirname(node))}:/usr/bin:/bin</string>
</dict>
<key>StandardOutPath</key><string>${escape(path.join(root,'.local-updater/service.log'))}</string>
<key>StandardErrorPath</key><string>${escape(path.join(root,'.local-updater/service-error.log'))}</string>
<key>ProcessType</key><string>Background</string>
</dict></plist>`);
