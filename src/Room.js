import { createHash } from "crypto"
import { EventEmitter } from "node:events"
import Uwuifier from 'uwuifier';

import RoomSettings from "./RoomSettings.js";
import Crown from "./Crown.js";

const uwuifier = new Uwuifier();

class Room extends EventEmitter {
    constructor(server, _id, settings) {
        super();
        this._id = _id;
        this.server = server;
        this.crown = null;
        this.crowndropped = false;

        this.settings = this.verifySet(this._id, {
            set: settings
        });

        this.chatmsgs = [];
        this.ppl = new Map();
        this.connections = [];

        this.bindEventListeners();

        this.server.rooms.set(_id, this);
        this.bans = new Map();
    }

    join(client, set) { //this stuff is complicated
        let otheruser = this.connections.find((a) => a.user._id == client.user._id)
        if (!otheruser) {
            let participantId = createHash('sha512').update(Math.random().toString() + client.ip).digest('hex').slice(0, 24);

            client.user.id = participantId;
            client.participantId = participantId;
            client.initParticipantQuotas();

            if (((this.connections.length == 0 && Array.from(this.ppl.values()).length == 0) && !this.isLobby(this._id)) || this.crown && (this.crown.userId == client.user._id)) { //user that created the room, give them the crown.
                //client.quotas.a.setParams(Quota.PARAMS_A_CROWNED);
                this.crown = new Crown(client.participantId, client.user._id);
                this.crowndropped = false;
                this.settings = new RoomSettings(set, 'user');
            } else {
                //client.quotas.a.setParams(Quota.PARAMS_A_NORMAL);
                if (this.isLobby(this._id)) {
                    this.settings = new RoomSettings(this.server.defaultLobbySettings, 'user');
                    this.settings.visible = true;
                    this.settings.crownsolo = false;
                    this.settings.color = this.server.defaultLobbySettings.color;
                    this.settings.color2 = this.server.defaultLobbySettings.color2;
                    this.settings.lobby = true;
                } else {
                    if (typeof(set) == 'undefined') {
                        if (typeof(this.settings) == 'undefined') {
                            this.settings = new RoomSettings(this.server.defaultRoomSettings, 'user');
                        } else {
                            this.settings = new RoomSettings(client.channel.settings, 'user');
                        }
                    } else {
                        this.settings = new RoomSettings(set, 'user');
                    }
                }
            }
            this.ppl.set(participantId, client);

            this.connections.push(client);

            this.sendArray([{
                color: this.ppl.get(client.participantId).user.color,
                id: this.ppl.get(client.participantId).participantId,
                m: "p",
                name: this.ppl.get(client.participantId).user.name,
                tag: this.ppl.get(client.participantId).user.tag,
                x: this.ppl.get(client.participantId).x || 200,
                y: this.ppl.get(client.participantId).y || 100,
                _id: client.user._id
            }], client, false)

            client.sendArray([{
                m: "c",
                c: this.chatmsgs.slice(-1 * 32)
            }]);

            this.updateCh(client, this.settings);
        } else {
            client.user.id = otheruser.participantId;
            client.participantId = otheruser.participantId;
            client.quotas = otheruser.quotas;

            this.connections.push(client);

            client.sendArray([{
                m: "c",
                c: this.chatmsgs.slice(-1 * 32)
            }])

            this.updateCh(client, this.settings);
        }

    }
    remove(p) { //this is complicated too
        let otheruser = this.connections.filter((a) => a.user._id == p.user._id)
        if (!(otheruser.length > 1)) {
            this.ppl.delete(p.participantId);
            this.connections.splice(this.connections.findIndex((a) => a.connectionid == p.connectionid), 1);
            console.log(`Deleted client`);
            if (this.crown) {
                if (this.crown.userId == p.user._id && !this.crowndropped) {
                    this.chown();
                }
            }

            this.sendArray([{
                m: "bye",
                p: p.participantId
            }], p, false);


            this.updateCh(p);
        } else {
            this.connections.splice(this.connections.findIndex((a) => a.connectionid == p.connectionid), 1);
        }

    }
    updateCh(client) { //update channel for all people in channel
        if (Array.from(this.ppl.values()).length <= 0) this.destroy();
        this.connections.forEach((usr) => {
            let racer = this.server.connections.get(usr.connectionid); // Racy race condition! Uh oh!
            if(racer) {
                racer.sendArray([this.fetchData(usr, client)])
            }
        })
        this.server.updateRoom(this.fetchData());
    }
    updateParticipant(pid, options) {
        let p = null;
        Array.from(this.ppl).map(rpg => {
            if(rpg[1].user._id == pid) p = rpg[1];
        });
        if (p == null) return;
        options.name ? p.user.name = options.name : {};
        options._id ? p.user._id = options._id : {};
        options.color ? p.user.color = options.color : {};
        options.tag ? p.user.tag = options.tag : {};

        this.connections.filter((ofo) => ofo.participantId == p.participantId).forEach((usr) => {
            options.name ? usr.user.name = options.name : {};
            options._id ? usr.user._id = options._id : {};
            options.color ? usr.user.color = options.color : {};
            options.tag ? usr.user.tag = options.tag : {};
        })

        this.sendArray([{
            color: p.user.color,
            id: p.participantId,
            m: "p",
            name: p.user.name,
            tag: p.user.tag,
            x: p.x || 200,
            y: p.y || 100,
            _id: p.user._id
        }]);
    }
    destroy() { //destroy room
        this._id;
        console.log(`Deleted room ${this._id}`);
        this.settings = {};
        this.ppl;
        this.connnections;
        this.chatmsgs;
        this.server.rooms.delete(this._id);
    }
    sendArray(arr, not, onlythisparticipant) {
        this.connections.forEach((usr) => {
            if (!not || (usr.participantId != not.participantId && !onlythisparticipant) || (usr.connectionid != not.connectionid && onlythisparticipant)) {
                try {
                    this.server.connections.get(usr.connectionid).sendArray(arr)
                } catch (e) {
                    console.log(e);
                }
            }
        })
    }
    fetchData(usr, client) {
        let chppl = [];
        [...this.ppl.values()].forEach((a) => {
            chppl.push(a.user);
        })
        let data = {
            m: "ch",
            p: "ofo",
            ch: {
                count: chppl.length,
                crown: this.crown,
                settings: this.settings,
                _id: this._id
            },
            ppl: chppl
        }
        if (client) {
            if (usr.connectionid == client.connectionid) {
                data.p = client.participantId;
            } else {
                delete data.p;
            }
        } else {
            delete data.p;
        }
        if (data.ch.crown == null) {
            delete data.ch.crown;
        } else {

        }
        return data;
    }
    verifyColor(strColor) {
        var test2 = /^#[0-9A-F]{6}$/i.test(strColor);
        if (test2 == true) {
            return strColor;
        } else {
            return false;
        }
    }
    isLobby(_id) {
        return (_id.startsWith("lobby")) ?
            /^lobby\d*$/gm.test(_id) ? true : false
            : (_id.startsWith("test/")) ? !(_id == "test/") : false
    }
    getCrownY() {
        return 50 - 30;
    }
    getCrownX() {
        return 50;
    }
    chown(id) {
        let prsn = this.ppl.get(id);
        if (prsn) {
            this.crown = {
                participantId: prsn.participantId,
                userId: prsn.user._id,
                time: Date.now(),
                startPos: {
                    x: 50,
                    y: 50
                },
                endPos: {
                    x: this.getCrownX(),
                    y: this.getCrownY()
                },
            }
            this.crowndropped = false;
        } else {
            this.crown = {
                userId: this.crown.userId,
                time: Date.now(),
                startPos: {
                    x: 50,
                    y: 50
                },
                endPos: {
                    x: this.getCrownX(),
                    y: this.getCrownY()
                }
            }
            this.crowndropped = true;
        }
        this.updateCh(prsn);
    }
    setCords(p, x, y) {
        if (p.participantId && this.ppl.get(p.participantId)) {
            x ? this.ppl.get(p.participantId).x = x : {};
            y ? this.ppl.get(p.participantId).y = y : {};
            this.sendArray([{
                m: "m",
                id: p.participantId,
                x: this.ppl.get(p.participantId).x,
                y: this.ppl.get(p.participantId).y
            }], p, false);
        }
    }

    chat(p, msg) {
        if (msg.message.length > 512) return;
        let filter = ["AMIGHTYWIND", "CHECKLYHQ"];
        let regexp = new RegExp("\\b(" + filter.join("|") + ")\\b", "i");
        if (regexp.test(msg.message)) return;
        let prsn = this.ppl.get(p.participantId);
        if (prsn) {
            if(p.user.flags.get("chat_curse_1") == true) {
                msg.message = msg.message.replace(/[aeiou]/gm, "o");
                msg.message = msg.message.replace(/[AEIOU]/gm, "O");
            }

            if(p.user.flags.get("chat_curse_2") == true) {
               msg.message = msg.message.split("").map(z => Math.random() < 0.9 ? String.fromCharCode(z.charCodeAt(0)+Math.floor(Math.random() * 20 - 10)) : z).join("")
            }

            if(p.user.flags.get("chat_curse_3") == true) {
                msg.message = uwuifier.uwuifySentence(msg.message);
            }

            let message = {};
            message.m = "a";
            message.a = msg.message;
            message.p = {
                color: p.user.color,
                id: p.participantId,
                name: p.user.name,
                _id: p.user._id
            };
            message.t = Date.now();
            this.sendArray([message]);
            this.chatmsgs.push(message);
        }
    }
    playNote(client, note) {
        this.sendArray([{
            m: "n",
            n: note.n,
            p: client.participantId,
            t: note.t
        }], client, true);
    }
    kickban(_id, ms) {
        ms = parseInt(ms);
        if (ms >= (1000 * 60 * 60)) return;
        if (ms < 0) return;
        ms = Math.round(ms / 1000) * 1000;
        let user = this.connections.find((usr) => usr.user._id == _id);
        if (!user) return;
        let asd = true;
        let pthatbanned = this.ppl.get(this.crown.participantId);
        this.connections.filter((usr) => usr.participantId == user.participantId).forEach((u) => {
            user.bantime = Math.floor(Math.floor(ms / 1000) / 60);
            user.bannedtime = Date.now();
            user.msbanned = ms;
            this.bans.set(user.user._id, user);
            if (this.crown && (this.crown.userId)) {
                u.setChannel("test/awkward", {});
                if (asd)
                    this.Notification(user.user._id,
                        "Notice",
                        `Banned from \"${this._id}\" for ${Math.floor(Math.floor(ms / 1000) / 60)} minutes.`,
                        "",
                        7000,
                        "#room",
                        "short"
                    )
                if (asd)
                    this.Notification("room",
                        "Notice",
                        `${pthatbanned.user.name} banned ${user.user.name} from the channel for ${Math.floor(Math.floor(ms / 1000) / 60)} minutes.`,
                        "",
                        7000,
                        "#room",
                        "short"
                    )
                if (this.crown && (this.crown.userId == _id)) {
                    this.Notification("room",
                        "Certificate of Award",
                        `Let it be known that ${user.user.name} kickbanned him/her self.`,
                        "",
                        7000,
                        "#room"
                    );
                }

            }

        })
    }
    Notification(who, title, text, html, duration, target, klass, id) {
        let obj = {
            m: "notification",
            title: title,
            text: text,
            html: html,
            target: target,
            duration: duration,
            class: klass,
            id: id
        };
        if (!id) delete obj.id;
        if (!title) delete obj.title;
        if (!text) delete obj.text;
        if (!html) delete obj.html;
        if (!target) delete obj.target;
        if (!duration) delete obj.duration;
        if (!klass) delete obj.class;
        switch (who) {
            case "all": {
                for (let con of Array.from(this.server.connections.values())) {
                    con.sendArray([obj]);
                }
                break;
            }
            case "room": {
                for (let con of this.connections) {
                    con.sendArray([obj]);
                }
                break;
            }
            default: {
                Array.from(this.server.connections.values()).filter((usr) => usr.user._id == who).forEach((p) => {
                    p.sendArray([obj]);
                });
            }
        }
    }
    bindEventListeners() {
        this.on("bye", participant => {
            this.remove(participant);
        })

        this.on("m", (participant, x, y) => {
            this.setCords(participant, x, y);
        })

        this.on("a", (participant, msg) => {
            this.chat(participant, msg);
        })
    }
    verifySet(_id,msg){
        if(typeof(msg.set) !== 'object') {
            msg.set = {
                visible: true,
                color: this.server.defaultSettings.color, chat:true,
                crownsolo:false
            }
        }

        msg.set = RoomSettings.changeSettings(msg.set);

        if (typeof(msg.set.lobby) !== 'undefined') {
            if (msg.set.lobby == true) {
                if (!this.isLobby(_id)) delete msg.set.lobby; // keep it nice and clean
            } else {
                if (this.isLobby(_id)) {
                    msg.set = this.server.defaultLobbySettings;
                }
            }
        }
        return msg.set;
    }

}
export default Room;
