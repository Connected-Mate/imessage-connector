# iMessage Connector — setup instructions for coding agents

> You are a coding agent (Claude Code, Codex, Cursor, Gemini CLI, Copilot, Windsurf…).
> A person pasted a prompt asking you to install iMessage Connector. Follow these steps in order.
> **Speak the person's language** (the one they wrote their prompt in). They may not be technical:
> use plain words, ask only what is strictly needed, and **ask before any sensitive action**
> (password prompt, admin rights, installing software, deleting or overwriting files, editing your own
> settings, sending a message). Never print, log or store secrets, phone numbers or message contents.
> Run each step yourself; only hand over to the person for the clicks only they can make.

## 0. What iMessage Connector is
iMessage Connector lets a coding agent read and send iMessages on this Mac, under a strict policy the person controls. It is an MCP server plus a command-line tool, `imsgc`. It runs only on macOS, has no native dependencies, and sends nothing anywhere except through the Messages app already on the Mac.

What this guide changes on the machine:
- a global npm install of the `imessage-connector` package, downloaded from the official release (it puts the `imsgc` command on the PATH);
- a link making the `imsgc` command available;
- a policy folder `~/.imessage-connector/` (config, audit log, bindings; files are private to the user);
- one entry registering the server in your agent's MCP configuration;
- macOS privacy permissions, granted by the person.

Nothing is sent and no conversation is read until the person has chosen which conversations are in scope.

## 1. Check prerequisites
Run each check and report only problems.
- macOS: `sw_vers -productVersion`. Tested on macOS 26.6.2. No minimum is enforced by the code; on other versions run `imsgc doctor` and trust what it reports.
- Node.js 22.13 or later: `node -v` → `v22.13.0` or higher. If missing or older, offer to install it and **ask first**: `brew install node` if `brew --version` works, otherwise nvm (`nvm install 22`). Do not run an installer without a yes.
- Messages is signed in on this Mac: ask the person to open Messages and confirm they see their conversations. You cannot check this reliably yourself.
- Know which terminal application you are running inside (Terminal, iTerm2, Ghostty, Cursor, VS Code…). You need its name in step 3.

## 2. Install (safe to run twice)
iMessage Connector is free to use but not open source: install the official package, never a copy from anywhere else.
```
npm install -g https://github.com/Connected-Mate/imessage-connector/releases/latest/download/imessage-connector.tgz
imsgc --help
```
`imsgc --help` must print the command list and exit 0. Running the same command again updates to the latest version.
If the install fails with a permissions error (`EACCES`), do **not** use sudo: ask the person, then either use a Node installed with Homebrew or nvm (their global folder is writable), or set a user prefix (`npm config set prefix ~/.npm-global`, add `~/.npm-global/bin` to the PATH in `~/.zshrc`) and run the install again.
Where the package landed, for the MCP entries below: `echo "$(npm root -g)/imessage-connector/dist/index.js"` — call this path **INDEX** (absolute, use it exactly as printed).

## 3. Configure
1. Create the policy: `imsgc init`. It writes `~/.imessage-connector/config.toml` (mode "interactive": read, send; every conversation in scope until narrowed). If the file already exists it refuses (exit 1) and changes nothing — that is fine, keep going.
2. Register the server with your agent:
   - **Claude Code**: `imsgc install claude` (uses `claude mcp add --scope user`, falls back to merging into `~/.claude.json`; other servers are kept).
   - **Codex**: `imsgc install codex` (adds a `[mcp_servers.imessage-connector]` block to `~/.codex/config.toml`, rest untouched).
   - **Cursor** (verified in Cursor docs): add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project), merging with what is there:
     `{"mcpServers":{"imessage-connector":{"type":"stdio","command":"node","args":["INDEX"]}}}`
   - **Gemini CLI** (verified in its docs): same shape without `type`, in `~/.gemini/settings.json` (or `.gemini/settings.json`).
   - **OpenCode** (verified in OpenCode docs, https://opencode.ai/docs/mcp-servers): add under the `mcp` key of `opencode.json` / `opencode.jsonc` (project root, or the global OpenCode config, usually `~/.config/opencode/opencode.jsonc`; the docs page does not state the global path, so check `opencode --version` and its config docs). `command` is one array, not command + args:
     `{"mcp":{"imessage-connector":{"type":"local","command":["node","INDEX"],"enabled":true}}}`
   - **Kimi Code** (verified in Kimi docs, https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html): merge into `~/.kimi-code/mcp.json` (user level; project-level `.kimi-code/mcp.json` also works but runs commands at session start, so prefer user level). Or let the person run `/mcp-config` inside Kimi Code.
     `{"mcpServers":{"imessage-connector":{"command":"node","args":["INDEX"]}}}`
   - **Antigravity** (Google; path verified in https://codelabs.developers.google.com/developer-knowledge-mcp-antigravity and https://developers.google.com/workspace/guides/configure-mcp-servers): merge into `~/.gemini/config/mcp_config.json` (shared by the IDE and CLI; UI route: MCP Servers → Manage MCP Servers → View raw config). Google's pages only show remote `serverUrl` entries, so the stdio shape below is (not verified here); if it does not load, tell the person.
     `{"mcpServers":{"imessage-connector":{"command":"node","args":["INDEX"]}}}`
   - **Copilot** (VS Code, verified in https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/extend-copilot-chat-with-mcp): `.vscode/mcp.json` in the project, top-level key is `servers` (not `mcpServers`). Copilot CLI: (not verified here).
     `{"servers":{"imessage-connector":{"type":"stdio","command":"node","args":["INDEX"]}}}`
   - **Windsurf** (https://docs.devin.ai/desktop/cascade/mcp; docs say this file serves the legacy Cascade agent only): `~/.config/devin/mcp_config.json` on macOS/Linux. Older installs used a different location (not verified here), so confirm which file the person's Windsurf reads.
     `{"mcpServers":{"imessage-connector":{"command":"node","args":["INDEX"]}}}`
   - **Others**: not verified here. Add an MCP server entry in that tool's own MCP settings with command `node` and the absolute INDEX path from step 2 (relative paths fail). Tell the person you could not confirm that tool's config location.
   Show the person the change and get a yes before editing any file that is not ours. Then say plainly: **restart the agent so it loads the new server.**
3. Permissions — run `imsgc doctor` and **loop**: read what it flags, fix it, re-run, until it ends with `No problems found.` (exit 0). Explain each click in plain words before opening the pane:
   - **Full Disk Access** — "so the agent can read your conversations." Goes to the **terminal application** that runs your agent (Terminal, iTerm2, Ghostty, Cursor, VS Code…), **not node**. Open the pane: `open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"` (manual path: System Settings → Privacy & Security → Full Disk Access). The person switches the terminal on, then **fully quits and reopens the terminal** (the permission only applies to new processes); the agent must be restarted too.
   - **Automation → Messages** — "so the agent can send through Messages." The first send raises a macOS dialog asking to control Messages; the person must click Allow. **Until it is answered, calls hang** — if `doctor` or a send stalls, ask the person to look for that dialog (it may be behind other windows). Pane if they refused it: `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"`, then enable Messages under the terminal's entry.
   - **Accessibility** — usually skip. Only needed if sending through Automation does not work and the person agrees to the interface fallback (`ui_automation = true`, which types into the Messages window). Pane: `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`. Reactions (tapbacks), pinning and replies in a thread do not work on macOS 26 and later — never offer them.
   These URL schemes come from the project's own code; if a pane does not open, give the manual path above.
4. Narrow the scope (recommended, ask the person): in `~/.imessage-connector/config.toml` set `[chats] allow = ["Name or +number", …]` to the conversations the agent may touch. Optional safety: `[schedule] quiet_hours = ["22:00-08:00"]`, `[approval] mode = "first_time"`. Keep rate limits as shipped (3/min and 20/hour per chat, 60/hour global).
5. The person may later freeze the policy so no agent can loosen it, **themselves in a real terminal**: `imsgc seal` (a tripwire: any change locks everything down until they re-seal) or `imsgc seal --system` (asks for their administrator password; changing it then needs `imsgc seal --system` / `imsgc unseal --system`). You cannot and must not do this; it refuses without a terminal.

## 4. Per-conversation setup
Goal: for each conversation the person cares about, decide what the agent may do there (Off / Notify / Read / Interactive), which agent answers (Claude Code, Codex or nobody), which project folder it works in, whether the conversation is fixed to that folder, whether the agent answers on its own (auto-reply), and whether it writes as the person's assistant or as the person (`speak_as`). Everything is off until the person switches it on.

**Preferred: the local page.** Run `imsgc app` **in the background** (it keeps running until stopped; it has no `--help`, so do not run `imsgc app --help`, which would start it). It prints and opens a private address on this Mac only (`http://127.0.0.1:<port>/s/<secret>`), valid only while the command runs. Use `imsgc app --no-open` to print the address without opening a browser, and give it to the person. The page shows:
- a setup checklist (policy file, Full Disk Access, Automation → Messages, Accessibility (optional), Messages open, the auto-reply service), each with Ready / Needed and an "Open System Settings" button;
- per conversation: access level, which agent answers, project folder (typed or picked), "fixed to this folder", "answer on its own". A setting forbidden by another rule shows locked, with the file that decides it.
Walk the person through it conversation by conversation, wait until they say they are done, then stop the command (Ctrl-C or kill the background process).

**Without the page (command line).** Conversation ids (`chat guid`) come from `imsgc state --json`, field `chats[].chat`; never print the list to the person, describe it.
- Access, agent, folder, auto-reply for one conversation (omitted fields keep their value; written to `~/.imessage-connector/chats.toml`):
  `echo '{"chat":"<chat guid>","read":true,"write":true,"agent":"claude","project":"/absolute/folder","autoReply":true}' | imsgc access --json`
  (`agent` is `"claude"`, `"codex"` or `"none"`; `project` must be an absolute folder, not the whole disk or home folder.)
- Fix a conversation to a project folder: `imsgc link --project /absolute/folder --chat "<chat guid>"` (a link wins over `project`). Undo with `imsgc unlink --id <id>`; list with `imsgc bindings`.
- Equivalent hand-written policy in `~/.imessage-connector/config.toml`:
  ```toml
  mode = "interactive"
  [remote]
  commanders = ["<the person's own number or Apple ID email>"]   # mandatory for auto-reply
  [chat."<chat guid>"]
  agent = "claude"          # "claude" | "codex" | "none" (default none)
  project = "/absolute/folder"
  auto_reply = true         # default false
  ```

**As you, or as itself — ask for EVERY conversation you connect (required).** Before you finish a conversation, ask the person, in plain words:
> "In this conversation, should the agent answer **as your assistant** — its messages start with 🤖 and it says it is your assistant — or **as you** — no 🤖, written the way you text?"

Explain the difference honestly: *as your assistant* is transparent, everyone sees a program wrote it; *as you* means the people in that conversation will not see that a program wrote the message, so suggest it only where that is fine for the person and for the people they write to (their own notes, someone who knows). If they hesitate, keep the default, **as your assistant** (`speak_as = "agent"`). Never choose "as you" on your own.
How to set it, per conversation (contact names work as conversation keys):
- on the settings page (`imsgc app`), or
- `echo '{"chat":"<chat guid>","speak_as":"me"}' | imsgc access --json` (`"agent"` or `"me"`; omitted = unchanged), or
- in `~/.imessage-connector/config.toml`:
  ```toml
  [chat."Maman"]
  speak_as = "me"
  ```
Rules: do **not** write `speak_as = "agent"` at the top level of config.toml (it would override every per-conversation "me"), and do **not** set `[content] require_marker = true` if any conversation is "me" (it forces the 🤖 everywhere). For "me", the agent needs the person's first name: Contacts' "Me" card is used if it exists; otherwise run `imsgc init --name <first name>` or add `[me]` / `name = "<first name>"` to config.toml.

**Auto-reply (the agent answers texts by itself).** Only if the person wants it, and only for the conversations they name. Explain in one sentence: "when you text that conversation, your Mac runs Claude Code or Codex in its folder and texts the answer back — signed 🤖, or in your name if you chose “as you” for that conversation." Requirements, all mandatory:
1. `[remote] commanders` lists who may trigger it (ask the person for their own number or Apple ID email; never guess). In a group, a message must mention the agent (`@agent`, `@claude`, `@codex`, `@imsg`).
2. The conversation has `agent`, a `project` (or a link) and `auto_reply = true`. `approval.mode = "always"` blocks auto-reply; `first_time` is fine.
3. Try it in the foreground first: `imsgc daemon` (same as `imsgc daemon run`; Ctrl-C stops). Then, with the person's OK, install the background service: `imsgc daemon install` (starts at login, restarts if it stops). Other commands: `imsgc daemon status` (each switched-on conversation and, in plain words, whether it will answer and why not), `imsgc daemon restart`, `imsgc daemon uninstall`. Tuning flags for `run`/`install`: `--working-after <s>` (default 20, `0` = no "Working on it…" text), `--run-timeout <s>` (default 300), `--cooldown <s>` (default 5).
4. **The background service needs its own permissions** — the terminal's do not carry over. `imsgc daemon install` prints the exact `node` path: the person adds it under System Settings → Privacy & Security → Full Disk Access. At the first reply macOS asks to let `node` control Messages: they click Allow. Then run `imsgc daemon restart` and check `imsgc daemon status`. If node is upgraded or moved, grant it again and re-run `imsgc daemon install`. Log: `~/.imessage-connector/logs/daemon.log`.
What it will and will not do, to tell the person plainly: answers carry 🤖 (unless that conversation is set to speak as the person) and obey the same rate limits, filters and quiet hours (texts arriving in quiet hours are dropped, not answered later); texts older than 10 minutes are ignored; the agent reads only inside its folder (Claude Code: Read/Grep/Glob; Codex: read-only sandbox), may edit files only if the policy mode is `full`, and never runs shell commands; 5-minute limit per answer; after 3 failures in a row the conversation pauses 5 minutes, up to 1 hour. Any file saying `auto_reply = false` (including a sealed policy) switches it off.

**Notify when a task finishes (optional).** Show the person this Claude Code recipe and install it **only with their explicit OK**; never edit `~/.claude/settings.json` silently, and merge with existing hooks rather than replacing them:
```
{ "hooks": { "Stop": [ { "matcher": "", "hooks": [
  { "type": "command", "command": "imsgc notify --from-hook" }
] } ] } }
```
`imsgc notify --from-hook` reads what Claude Code hands every Stop hook (the project folder and Claude's last reply) and texts a one-line summary to the conversation bound to that project. It is refused by the policy like any send (quiet hours, rate limits, approval) and never stops Claude from finishing. Bind the project first (`imsgc link`). For a manual notice: `imsgc notify --task "…" --outcome done`.

**The menu bar app (recommended).** Offer it — "so you always see, at the top right of your screen, which conversations are connected to which agent, and can pause everything in one click." Run `imsgc menubar install` (copies **iMessage Connector.app** to `~/Applications` and starts it; it downloads the signed, notarized release when there is no local build, and refuses a copy not signed by the project). Exit 0 = installed. Then tell the person: click the speech bubble in the menu bar; the first time, turn on **iMessage Connector** in Full Disk Access (the app opens that pane), and switch on "Open at login" in it if they want it always there. If the person prefers, they can instead download `https://github.com/Connected-Mate/imessage-connector/releases/latest` themselves. Needs macOS 14+.

## 5. Prove it works
1. `imsgc status` → shows the mode, capabilities, `Bindings: N`; exit 0. No line may say `LOCKED DOWN`.
2. List the conversations: `imsgc state --json` (or the MCP tool `imsg_chats` after restarting the agent). Report only **counts and a plain summary** ("I can see 22 conversations, 3 are groups, the policy allows 2"). **Do not print message contents, names or phone numbers**, and do not dump the JSON.
3. **Ask the person** before any send: "May I send one test message to your own conversation (for example the one with yourself)?" Wait for a clear yes and for them to name the conversation. Then send one short message with `imsgc notify --task "test iMessage Connector"` (needs a bound project) or the MCP tool `imsg_send`. Exit 0 / "Sent via applescript" = success. If it returns "approval needed" with a token (exit 3), show the person the exact draft text and send again quoting the token only if they approve.
4. Tell the person, in two plain sentences: what is now installed and which conversations the agent can use, and how to remove it (step 6). Mention what you could not verify.

## 6. Uninstall
Ask before each removal.
- Unregister: `imsgc uninstall claude` and/or `imsgc uninstall codex` (removes only our entry). For Cursor / Gemini CLI / others, delete the `imessage-connector` entry from that tool's config.
- Remove the command: `npm uninstall -g imessage-connector`.
- Delete `~/.imessage-connector` (config, audit log, bindings) **only after asking**, because the audit log is the person's record.
- Remove the menu bar app: `imsgc menubar uninstall` (quits it, takes it out of Login Items, moves it to the Trash).
- Stop auto-reply: `imsgc daemon uninstall` (removes the background service), then remove the `node` entry from Full Disk Access and Automation if the person wants.
- Remove the Stop hook from `~/.claude/settings.json` if it was added.
- Revoke permissions: System Settings → Privacy & Security → Full Disk Access / Automation / Accessibility → switch off or remove the terminal app entry (the person does this).

## Troubleshooting
| Symptom | Cause → fix |
|---|---|
| `doctor` or a send **hangs** | The macOS Automation dialog ("wants to control Messages") is unanswered. Ask the person to find it and click Allow. |
| `chat.db: NOT readable` | Full Disk Access given to the wrong app (or not yet effective). Grant it to the terminal application running the agent, **quit and reopen that terminal**, restart the agent. |
| `LOCKED DOWN: …` | Sealed policy was changed or its lock no longer matches (or no config exists: run `imsgc init`). Only the person can fix a seal mismatch: they run `imsgc seal` (or `imsgc seal --system` if they used it) in a real terminal. Do not try to bypass. |
| Send refused: quiet hours | The policy's `[schedule] quiet_hours` window is active. Wait, or the person edits the schedule. Do not change it yourself to get around it. |
| Send refused: rate limit | Per-chat 3/min, 20/hour, global 60/hour by default. Wait; `imsgc status` shows usage. |
| "approval needed", token printed (exit 3) | The conversation needs approval. Show the exact draft to the person; resend quoting the token only on their yes. Tokens expire and are tied to that exact text. |
| `unknown setting "…"` in doctor | Typo in `config.toml`; the server will not start until fixed. |
| `imsgc: command not found` | The npm global `bin` folder is not on the PATH: `npm prefix -g` shows it; add its `bin` to the PATH, or call `node "$(npm root -g)/imessage-connector/dist/cli.js"`. |
| Tools missing in the agent | Restart the agent after registering the server. |
| Auto-reply never answers | Run `imsgc daemon status`: it names the reason (no commander, auto_reply off somewhere, missing folder, approval `always`, quiet hours). `Permission denied reading …/chat.db` in the log = Full Disk Access missing for the `node` path printed by `daemon install`. |
| `imsgc app` seems to hang | It is a running server by design. Open the printed address; stop it with Ctrl-C when done. |
| Everything refused | `imsgc pause` is active (a `PAUSE` file in `~/.imessage-connector`); the person runs `imsgc resume`. |
