# mpp-server v2
### This server is a **VERY** **INSANELY** **EXTRME**ly modded version of bop-it's server
## Features:
1. All references of `cl` have been changed to `client`
2. Database has been changed to use better-sqlite3
3. All old, or ancient package have been updated or entierly removed
4. New admin messages, notification and user_flag
5. Tons of new and interesting flags
6. Also new messages and protocol
7. Full compat with MPPclone client including sitebanning, chat clearing and tagging
8. Chat curse _1 and _2 implementations, _1 being aeiou->o and _2 being extra-spoopifier (text garbager)
9. New chat curse _3, which uwu-ifies your text
10. Hri7566's Room Settings changes, which fix all crown/chown related issues
11. Everything has been ESM-ified
12. Full quota rewrite removing RateLimit/Quota ambiguity
13. Quote permissions providing granularity
14. Ported over `custom` capability
15. Ported over `dm` too, supporting all types of dms and also chathistory for those dms.
16. Full token support
17. !js and !createToken, allowing for interacting with the server through the chat.

## Flags
1. chownAnywhere, usersetOthers, siteBan, siteBanAnyDuration
2. siteBanAnyReason, clearChat, tagging
3. chat_curse_1, chat_curse_2, chat_curse_3

### Permission Flags
1. quotaAlways.*.*
2. quotaBypass.*
3. command.*

### Example:

quotaAlways.note.2 -> Always sets the quota note to be set to Crowned

quotaBypass.userset -> Disables the quota userset

command.js -> Allows the user to use the !js command

## New messages
tag, clearchat, setcolor, setname, siteban, admin message, custom, dm
