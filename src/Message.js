import { sitebanDatabase } from "./Database.js";

import User from "./User.js";

function ms(t) {
    let year,
        month,
        day,
        hour,
        minute,
        second;

    second = Math.floor(t / 1000);
    minute = Math.floor(second / 60);
    second = second % 60;
    hour = Math.floor(minute / 60);
    minute = minute % 60;
    day = Math.floor(hour / 24);
    hour = hour % 24;
    month = Math.floor(day / 30);
    day = day % 30;
    year = Math.floor(month / 12);
    month = month % 12;

    let timeS = "";
    timeS += `${year ? year + "years, " : ""}${month ? month + "months, " : ""}${day ? day + "days, " : ""}`
    timeS += `${hour} hours, ${minute} minutes, ${second} seconds`

    return timeS;
}

function ran(client) {
    if(client.authenicated) return;

    client.welcoming = true;

    let user = new User(client);
    const data = user.getUserData();
    let ban = sitebanDatabase.getBan(data._id);
    client.user = data;

    if([...client.server.connections.values()].filter(z => {
        if(z.user && client.user)
            return z.user._id == client.user._id
    }).length >= 3) {
        client.sendArray([{
            "m": "notification",
            "duration": 300000,
            "id": "overUseNotification",
            "target": "#piano",
            "class": "classic",
            "title": "You are using too many clients!",
            "text": `${client.user._id} has allocated ≥3 clients!`
        }])
        client.destroy();
        return;
    }

    client.initializeQuotes();

    if(ban) {
        let timeLeft = ban.created-(Date.now()-ban.duration);

        if(timeLeft < 0) {
            sitebanDatabase.unban(data._id);
            return;
        }

        client.sendArray([{
            "m": "notification",
            "duration": 300000,
            "id": "banNotification",
            "target": "#piano",
            "class": "classic",
            "title": "You've been banned.",
            "text": `You were banned. Time left: ${ms(timeLeft)}. Reason: ${ban.reason}. Contact a staff member to get unbanned.`
        }])
        client.destroy();
        return;
    }

    let msg = [{
        m: "hi",
        motd: client.server.welcome_motd,
        t: Date.now(),
        u: data,
        v: "heavily modded bopit-server, with permissions, tags, proper chowning, room settings and admin tools!",
        permissions: {}
    }];

    [...data.flags].map(z=>msg[0].permissions[z[0]]=z[1])

    client.sendArray(msg)
    client.user = data;
}

export default (client) => {
    client.on("hi", () => ran(client));
    client.on("devices", () => ran(client));

    client.on("t", msg => {
        if (msg.hasOwnProperty("e") && !isNaN(msg.e))
            client.sendArray([{
                m: "t",
                t: Date.now(),
                e: msg.e
            }])
    })
    client.on("ch", msg => {
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = {};
        if (msg.hasOwnProperty("_id") && typeof msg._id == "string") {
            if (msg._id.length > 512) return;
            if (!client.quotas.channelChange.isAvailable()) return;
            client.setChannel(msg._id, msg.set);

            client.sendArray([{m:"nq",...client.quotas.note.getRaw()}])

            client.authenicated = true;
        }
    })
    client.on("m", (msg) => {
        if (!client.authenicated) return;
        if (!client.quotas.mouseMove.isAvailable()) return;
        if (!(client.channel && client.participantId)) return;
        if (!msg.hasOwnProperty("x")) msg.x = null;
        if (!msg.hasOwnProperty("y")) msg.y = null;
        if (parseInt(msg.x) == NaN) msg.x = null;
        if (parseInt(msg.y) == NaN) msg.y = null;
        client.channel.emit("m", client, msg.x, msg.y)
    })
    client.on("chown", (msg) => {
        if (!(client.channel && client.participantId)) return;
        if(client.user.flags.get("chownAnywhere")) {
            client.channel.chown(msg.id);
            return;
        }
        if (!client.quotas.chown.isAvailable()) return;

        //console.log((Date.now() - client.channel.crown.time))
        //console.log(!(client.channel.crown.userId != client.user._id), !((Date.now() - client.channel.crown.time) > 15000));
        if (!(client.channel.crown.userId == client.user._id) && !((Date.now() - client.channel.crown.time) > 15000)) return;
        if (msg.hasOwnProperty("id")) {
            // console.log(client.channel.crown)
            if (client.user._id == client.channel.crown.userId || client.channel.crowndropped)
                client.channel.chown(msg.id);
                if (msg.id == client.user.id) {
                    client.updateQuotaFlags(2);

                    client.sendArray([{m:"nq",...client.quotas.note.getRaw()}])
                }
        } else {
            if (client.user._id == client.channel.crown.userId || client.channel.crowndropped)
                client.updateQuotaFlags(0);
                client.channel.chown();

                client.sendArray([{m:"nq",...client.quotas.note.getRaw()}])
        }
    })
    client.on("chset", msg => {
        if (!(client.channel && client.participantId)) return;
        if (!(client.user._id == client.channel.crown.userId)) return;
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = client.channel.verifySet(client.channel._id,{});
        client.channel.settings = msg.set;
        client.channel.updateCh();
    })

    client.on("a", (msg, admin) => {
        if (!(client.channel && client.participantId)) return;
        if (!msg.hasOwnProperty('message')) return;
        if (!client.channel.settings.chat) return;
        if (!client.quotas.chat.isAvailable()) return;
        client.channel.emit('a', client, msg);
    })

    client.on('n', msg => {
        if (!(client.channel && client.participantId)) return;
        if (!msg.hasOwnProperty('t') || !msg.hasOwnProperty('n')) return;
        if (typeof msg.t != 'number' || typeof msg.n != 'object') return;
        if (!client.quotas.note.isAvailable()) return;
        if (client.channel.settings.crownsolo) {
            if ((client.channel.crown.userId == client.user._id) && !client.channel.crowndropped) client.channel.playNote(client, msg);
        } else {
            client.channel.playNote(client, msg);
        }
    })
    client.on('+ls', msg => {
        if (!(client.channel && client.participantId)) return;
        client.server.roomlisteners.set(client.connectionid, client);
        let rooms = [];
        for (let room of Array.from(client.server.rooms.values())) {
            let data = room.fetchData().ch;
            if (room.bans.get(client.user._id)) data.banned = true;
            if (room.settings.visible) rooms.push(data);
        }
        client.sendArray([{
            "m": "ls",
            "c": true,
            "u": rooms
        }])
    })
    client.on('-ls', msg => {
        if (!(client.channel && client.participantId)) return;
        client.server.roomlisteners.delete(client.connectionid);
    })
    client.on("userset", msg => {
        if (!(client.channel && client.participantId)) return;
        if (!msg.hasOwnProperty("set") || !msg.set) msg.set = {};
        if (msg.set.hasOwnProperty('name') && typeof msg.set.name == "string") {
            if (msg.set.name.length > 40) return;
            if(!client.quotas.userset.isAvailable()) return;
            client.user.name = msg.set.name;
            let user = new User(client);
            let data = user.getUserData();
            if (!data) return;
            data.name = msg.set.name;
            user.updateDatabase(data);
            client.server.rooms.forEach((room) => {
                room.updateParticipant(client.user._id, {
                    name: msg.set.name
                });
            })
        }
    })
    client.on('kickban', msg => {
        if (client.channel.crown == null) return;
        if (!(client.channel && client.participantId)) return;
        if (!client.channel.crown.userId) return;

        if(!client.user.flags.get("chownAnywhere")) if (!(client.user._id == client.channel.crown.userId)) return;

        if (msg.hasOwnProperty('_id') && typeof msg._id == "string") {
            if (!client.quotas.kickban.isAvailable() && !admin) return;
            let _id = msg._id;
            let ms = msg.ms || 3600000;
            client.channel.kickban(_id, ms);
        }
    })
    client.on("bye", msg => {
        client.destroy();
    })
    client.on("admin message", msg => {
        if (!(client.channel && client.participantId)) return;
        if (!msg.hasOwnProperty('password') || !msg.hasOwnProperty('msg')) return;
        if (typeof msg.msg != 'object') return;
        if (msg.password !== client.server.adminpass) return;
        client.ws.emit("message", JSON.stringify([msg.msg]), true);
    })
    client.on('-custom', msg => {
        if (!(client.channel && client.participantId)) return;
        client.server.customListeners.delete(client.connectionid);
    })
    client.on("+custom", msg => {
        client.server.customListeners.set(client.connectionid, client);
    })

    client.on("custom", msg => {
        if(!msg.target) return;
        if(!msg.data) return;
        if(typeof msg.target !== "object") return;
        if(!msg.target.mode) return;
        if(!msg.target.global) global = false; else global = true;

        let param = [{
            "m": "custom",
            "data": msg.data,
            p: client.user.id
        }];

        if(msg.target.mode == "subscribed") {
            for (let cc of Array.from(client.server.customListeners.values())) {
                if (!global) {
                    if(cc.channel._id !== client.channel._id) {
                        return;
                    }
                }
                cc.sendArray(param)
            }
        } else if(msg.target.mode == "id") {
            if(!msg.target.id) return;
            if(typeof msg.target.id !== "string") return;

            client.server.connections.forEach((usr) => {
                if (!global) {
                    if(usr.channel._id !== client.channel._id) {
                        return;
                    }
                }
                if (usr.user._id == msg.target.id || usr.user.id == msg.target.id) {
                    usr.sendArray(param);
                }
            })
        } else if(msg.target.mode == "ids") {
            if(!target.ids) return;
            if(!Array.isArray(target.ids)) return;
            if(target.ids.length > 32) return;
            if(!target.ids.every(i => typeof i === "string")) return;

            client.server.connections.forEach((usr) => {
                if (target.ids.includes(usr.id) || target.ids.includes(usr.user._id)) {
                    if (!global) {
                        if(usr.channel._id !== client.channel._id) {
                            return;
                        }
                    }
                    usr.sendArray(param);
                }
            })
        }

    })
    //admin only stuff
    client.on('setcolor', (msg, admin) => {
        let usersetOthers = client.user.flags.get("usersetOthers")
        if(!usersetOthers) return;
        if (typeof client.channel.verifyColor(msg.color) != 'string') return;
        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;
        client.server.connections.forEach((usr) => {
            if ((usr.channel && usr.participantId && usr.user) && (usr.user._id == msg._id || (usr.participantId == msg.id))) {
                let user = new User(usr);
                user.client.user.color = msg.color;
                let data = user.getUserData();
                if (!data._id) return;
                data.color = msg.color;
                user.updateDatabase(data);
                client.server.rooms.forEach((room) => {
                    room.updateParticipant(usr.user._id, {
                        color: msg.color
                    });
                })

            }
        })
    })

    client.on("siteban", (msg) => {
        if(!client.user.flags.get("siteBan")) return;
        if(msg.permanent) msg.duration = 3.154e+11;
        if (typeof msg.duration !== 'number') return;
        if (typeof msg.reason !== 'string') return;
        if (typeof msg.note !== 'string') return;
        if(msg.reason.length == 0) return;
        if (msg.duration > 1000 * 60 * 60 * 24 * 30 && !client.user.flags.get("siteBanAnyDuration")) return;
        let validReasons = ["Discriminaton","Inappropriate discussion","Sharing inappropriate content","Discussing self-harm","Piano spam in lobbies","Chat spam in lobbies","Evading site-wide punishments","Evading mutes or kickbans","Exploiting bugs","Phishing/IP grabbing","Abusing bots or scripts","Promoting violence/illegal activities","Promoting breaking the rules","Giving other user's personal information","Sending the same message in many rooms","Spamming the piano in many rooms","Holding the crown in someone else's room","Abusing permissions/quotas","Impersonation","Lying about other users"];

        if(!validReasons.includes(msg.reason) && !client.user.flags.get("siteBanAnyReason")) return;
        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;

        if(msg._id) {
            if(sitebanDatabase.getBan(msg._id)) {
                sitebanDatabase.unban(msg._id)
                return;
            }
        }

        client.server.connections.forEach((usr) => {
            if ((usr.channel && usr.participantId && usr.user) && (usr.user._id == msg._id || (usr.participantId == msg.id))) {
                let user = new User(usr);
                let data = user.getUserData();
                if (!data._id) return;
                sitebanDatabase.ban(data._id, msg.reason, msg.duration, msg.note, client.user._id);
                user.client.destroy();
            }
        })
    })
    client.on('setname', (msg, admin) => {
        let usersetOthers = client.user.flags.get("usersetOthers")
        if(!usersetOthers) return;
        if (typeof msg.name != 'string') return;
        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;
        client.server.connections.forEach((usr) => {
            if ((usr.channel && usr.participantId && usr.user) && (usr.user._id == msg._id || (usr.participantId == msg.id))) {
                let user = new User(usr);
                user.client.user.name = msg.name;
                let data = user.getUserData();
                if (!data._id) return;
                data.name = msg.name;
                user.updateDatabase(data);
                client.server.rooms.forEach((room) => {
                    room.updateParticipant(usr.user._id, {
                        name: msg.name
                    });
                })

            }
        })
    })

    client.on('user_flag', (msg, admin) => {
        if (!admin) return;
        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;
        if(typeof msg.key !== "string") return;
        if(!(typeof msg.value == "boolean" || typeof msg.value == "string")) return;

        client.server.connections.forEach((usr) => {
            if ((usr.channel && usr.participantId && usr.user) && (usr.user._id == msg._id || (usr.participantId == msg.id))) {
                let user = new User(usr);
                if(msg.value == false) {
                    user.client.user.flags.delete(msg.key)
                } else {
                    user.client.user.flags.set(msg.key, msg.value);
                }

                let data = user.getUserData()
                if (!data._id) return;
                data.flags = JSON.stringify([...user.client.user.flags]);
                user.updateDatabase(data);
            }
        })
    })

    client.on("clearchat", () => {
        if(!client.user.flags.get('clearChat')) return;

        client.channel.chatmsgs = []
        client.channel.connections.forEach(z => {
            z.sendArray([{
                m: "c",
                c: []
            }]);
        })
    })
    client.on('dm', (msg) => {
        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;
        if(typeof msg.message !== "string") return;
        if(msg.message.length >= 512) return;
        if (!client.quotas.dm.isAvailable()) return;

        let usr;

        for (const searc of client.server.connections.values()) {
            if ((searc.channel && searc.participantId && searc.user) && (searc.user._id == msg._id || (searc.participantId == msg.id))) {
                if(searc.channel._id !== client.channel._id) continue;

                usr = searc;
                break;
            }
        }

        if(!usr) return;

        let message = {
            m: "dm",
            t: Date.now(),
            a: msg.message,
            sender: {
                color: client.user.color,
                id: client.participantId,
                name: client.user.name,
                _id: client.user._id,
                tag: client.user.tag
            },
            recipient: {
                color: usr.user.color,
                id: usr.participantId,
                name: usr.user.name,
                _id: usr.user._id,
                tag: usr.user.tag
            }
        };

        client.sendArray([message]);
        usr.sendArray([message]);

        client.channel.chatmsgs.push(message);
    })

    client.on('tag', (msg) => {
        if(!client.user.flags.get('tagging')) return;

        if (!msg.hasOwnProperty('id') && !msg.hasOwnProperty('_id')) return;
        if(typeof msg.remove !== "boolean") return;
        if(!msg.hasOwnProperty("tag")) return;
        if(typeof msg.tag !== "object") return;
        if(typeof msg.tag.color !== "string" || typeof msg.tag.text !== "string") return;
        if(typeof client.channel.verifyColor(msg.tag.color) != 'string') return;
        if(msg.tag.text.length >= 15) return;

        client.server.connections.forEach((usr) => {
            if ((usr.channel && usr.participantId && usr.user) && (usr.user._id == msg._id || (usr.participantId == msg.id))) {
                let user = new User(usr);
                if(msg.remove) delete msg.tag;
                user.client.user.tag = msg.tag;
                let data = user.getUserData()
                if (!data._id) return;
                data.tag = msg.tag;
                client.server.rooms.forEach((room) => {
                    room.updateParticipant(usr.user._id, {
                        tag: msg.tag
                    });
                })
                user.updateDatabase(data);
            }
        })
    })

    client.on('notification', (msg, admin) => {
        if (!admin) return;
        if( typeof msg.id !== "string" ||
            typeof msg.class !== "string" ||
            typeof msg.target !== "string" ||
            typeof msg.duration !== "number"
        ) return;

        let param = {
            "m": "notification",
            "duration": msg.duration,
            "id": msg.id,
            "target": msg.target,
            "class": msg.class
        }

        if(msg.class == "short") {
            if(typeof msg.html !== "string") return;
            param.html = msg.html;
        } else if(msg.class == "classic") {
            if(msg.text && typeof msg.text !== "string") return;
            if(msg.title && typeof msg.title !== "string") return;
            param.text = msg.text;
            param.title = msg.title;
        } else {
            return;
        }

        if(msg.targetChannel == "all") {
            client.server.rooms.forEach((room) => {
                room.connections.forEach(z => {
                    if(msg.targetUser) {
                        if(z.user._id == msg.targetUser) z.sendArray([param])
                    } else {
                        z.sendArray([param])
                    }
                })
            })
        } else {
            if(typeof msg.targetChannel !== "string") return;
            const room = client.server.rooms.get(msg.targetChannel);

            if(room) {
                room.connections.forEach(z => {
                    if(msg.targetUser) {
                        if(z.user._id == msg.targetUser) z.sendArray([param])
                    } else {
                        z.sendArray([param])
                    }
                })
            }
        }
    })
}
