# Policy cookbook

Worked configurations, and the reasoning behind each. Every file below goes in
`~/.imessage-connector/config.toml` unless it says otherwise.

The rule that makes all of this safe to copy: **layers only narrow.** You can paste a stricter
fragment anywhere without checking what else is in force — it can tighten the result and never
loosen it.

---

## The safest thing that is still useful

The agent can tell you a job finished. It cannot read a single conversation.

```toml
mode = "notify"

[chats]
allow = ["+33600000000"]      # your own number

[approval]
mode = "first_time"
```

`notify` is not `read` minus sending — it is the other half. The agent gets `message.send` and
nothing else, so even if it were talked into snooping, there is no tool to do it with.

---

## Two-way with one person

```toml
mode = "interactive"

[chats]
allow = ["+33600000000"]

[content]
max_length = 1500
require_marker = true
marker = "🤖 "

[rate]
per_chat_per_minute = 3
per_chat_per_hour = 20

[schedule]
timezone = "Europe/Paris"
quiet_hours = ["22:00-08:00"]

[approval]
mode = "first_time"
```

`require_marker` labels every outbound message. Recipients should know they are talking to
software; it is also how you spot an agent that has started saying things you did not expect.
When two layers each name a marker, both are kept — a project's `marker` is added alongside
yours, never instead of it. Quiet hours and allowed days stay in the time zone of the file
that set them, so a project that declares another `timezone` cannot shift yours.

---

## Answering your mother as you, everyone else as the assistant

```toml
mode = "interactive"

[content]
marker = "🤖 "          # used wherever the agent speaks as itself — the default

[me]
name = "Alex"           # only needed when Contacts has no "Me" card

[chat."Maman"]          # a contact name works: every number she has is included
speak_as = "me"         # no marker; it writes as you
```

Do not set `require_marker = true` here: it would put the marker on her messages too. And do
not write `speak_as = "agent"` at the top of this file — the narrower value wins, so it would
override her `"me"`. Leaving it out already means "agent" everywhere else.

---

## Commanding the Mac from your phone

```toml
mode = "interactive"

[chats]
allow = ["+33600000000"]

[remote]
commanders = ["+33600000000"]
required_prefixes = ["!imsg"]
commands = ["status", "test", "build", "deploy"]
require_mention = true
```

Four gates have to pass before a message counts as an instruction. `commands` is the one worth
setting even when the others feel like enough: it turns "the agent does what the text says"
into "the agent does one of four things".

Bind the conversation for control from the agent:

```
imsg_bind { "chat": "+33600000000", "purpose": "control" }
```

---

## A team room

The agent posts build results and answers questions; humans reply in the same thread.

```toml
mode = "interactive"

[chats]
allow = ["Ship Room"]

[content]
require_marker = true
marker = "🤖 "

[rate]
per_chat_per_minute = 2
per_chat_per_hour = 15

[remote]
commanders = ["+33600000000", "colleague@example.com"]
required_prefixes = ["!imsg"]
require_mention = true
```

`require_mention` matters more in a group than anywhere else: without it, every message in a
busy channel is a candidate instruction.

---

## Keeping personal conversations out of it

Add to any layer. Deny-lists union across layers, so this survives everything else:

```toml
[chats]
deny = ["Famille*", "*perso*", "Maman", "+33611111111"]
```

Or per conversation, which also covers reads:

```toml
[chat."Famille*"]
mode = "off"
```

The second form is stronger: it applies to reading as well as sending, and it appears in
`imsg_status` as a named rule.

---

## A repository that may only ever notify

Checked into the project, at `.imessage-connector/config.toml`:

```toml
# This project's agent may report progress. It may not read conversations.
mode = "notify"

[rate]
per_chat_per_hour = 5
```

Safe to commit: a project layer cannot widen your machine-wide policy. Someone who sends you a
pull request changing this file cannot use it to grant themselves anything.

---

## Rules nothing can change

Put them in `~/.imessage-connector/policy.sealed.toml`, then pin them:

```toml
[chats]
deny = ["Famille*", "*perso*"]

[content]
require_marker = true
marker = "🤖 "
deny_patterns = [
  "(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----",
  "sk-[A-Za-z0-9_-]{20,}",
  "gh[pousr]_[A-Za-z0-9]{20,}",
]

[rate]
global_per_hour = 30

[schedule]
timezone = "Europe/Paris"
quiet_hours = ["23:00-07:00"]
```

```bash
imsgc seal      # from a terminal; it refuses when input is piped
```

Any edit to that file now puts the server in lockdown until you seal it again. Note what
belongs here: not `mode`, which you will want to change per project, but the handful of things
that should hold no matter what — conversations that are off limits, secrets that must never
go out, an upper bound on volume, and hours of the night.

---

## Filter patterns

Patterns are JavaScript regular expressions, with one accommodation: a leading `(?i)`, `(?m)`
or `(?s)` is translated into real flags, because that is what everyone writes and
`RegExp` rejects it. An inline group anywhere else is refused with an explanation.

```toml
[content]
# Refuse the message entirely.
deny_patterns = [
  "(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----",
  "AKIA[0-9A-Z]{16}",
  "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}",
]

# Send it, with the match replaced by [redacted].
redact_outbound = ["sk-[A-Za-z0-9_-]{20,}", "gh[pousr]_[A-Za-z0-9]{20,}"]
```

Use `deny_patterns` when the message is wrong to send at all, and `redact_outbound` when it is
fine once the secret is gone. A pattern that fails to compile stops the server at startup
rather than silently never matching.

---

## Reading the answer when something is refused

```
imsg_status
```

reports the effective mode, the capabilities that survive, the layers that produced them, what
is bound, and how much of the rate limit is spent. Every refusal also names the layer
responsible:

```
imsg_send refused: This conversation is on the deny list.
  (from /Users/you/.imessage-connector/policy.sealed.toml)
```

That attribution is worth reading before editing a file. Because layers narrow, editing the
*wrong* one changes nothing at all — the restriction is still coming from somewhere else.
