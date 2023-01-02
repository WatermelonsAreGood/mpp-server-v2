import Room from "./Room.js";
import Quota from "./Quota.js";
import message from "./Message.js"
import quotas from '../Quotas.js';
import config from "../config.js";

import { EventEmitter } from "node:events"
import { RateLimit, RateLimitChain } from './Ratelimit.js';

class Client extends EventEmitter {
    constructor(ws, req, server) {
        super();
        this.user;
        this.connectionid = server.connectionid;
        this.server = server;
        this.participantId;
        this.channel;
        this.staticQuotas = {
            room: new RateLimit(quotas.room.time)
        };
        this.ws = ws;
        this.req = req;
        if(config.xforwardedtrust) {
            this.ip = req.headers['x-forwarded-for'];
        } else {
            this.ip = (req.connection.remoteAddress).replace("::ffff:", "");
        }

        this.authenicated = false;
        this.dead = false;
        this.bindEventListeners();
        this.initParticipantQuotas();
        message(this);
    }

    isConnected() {
        return this.ws && this.ws.readyState === 1;
    }
    isConnecting() {
        return this.ws && this.ws.readyState === 0;
    }
    setChannel(_id, settings) {
        if (this.channel && this.channel._id == _id) return;
        if (this.server.rooms.get(_id)) {
            let room = this.server.rooms.get(_id, settings);
            let userbanned = room.bans.get(this.user._id);
            if (userbanned && (Date.now() - userbanned.bannedtime >= userbanned.msbanned)) {
                room.bans.delete(userbanned.user._id);
                userbanned = undefined;
            }
            if (userbanned) {
                room.Notification(this.user._id,
                    "Notice",
                    `Currently banned from \"${_id}\" for ${Math.ceil(Math.floor((userbanned.msbanned - (Date.now() - userbanned.bannedtime)) / 1000) / 60)} minutes.`,
                    7000,
                    "",
                    "#room",
                    "short"
                );
                this.setChannel("test/awkward", settings);
                return;
            }
            let channel = this.channel;
            if (channel) this.channel.emit("bye", this);
            if (channel) this.channel.updateCh();
            this.channel = this.server.rooms.get(_id);
            this.channel.join(this);
        } else {
            let room = new Room(this.server, _id, settings);
            this.server.rooms.set(_id, room);
            if (this.channel) this.channel.emit("bye", this);
            this.channel = this.server.rooms.get(_id);
            this.channel.join(this);
        }
    }
    sendArray(arr) {
        if (this.isConnected()) {
            //console.log(`SEND: `, JSON.colorStringify(arr));
            this.ws.send(JSON.stringify(arr));
        }
    }
    initParticipantQuotas() {
        this.quotas = {
            //"chat": new Quota(Quota.PARAMS_A_NORMAL),
            chat: {
                lobby: new RateLimitChain(quotas.chat.lobby.amount, quotas.chat.lobby.time),
                normal: new RateLimitChain(quotas.chat.normal.amount, quotas.chat.normal.time),
                insane: new RateLimitChain(quotas.chat.insane.amount, quotas.chat.insane.time)
            },
            cursor: new RateLimit(quotas.cursor.time),
            chown: new RateLimitChain(quotas.chown.amount, quotas.chown.time),
            userset: new RateLimitChain(quotas.userset.amount, quotas.userset.time),
            kickban: new RateLimitChain(quotas.kickban.amount, quotas.kickban.time),
            note: new Quota(Quota.PARAMS_LOBBY),
            chset: new Quota(Quota.PARAMS_USED_A_LOT),
            "+ls": new Quota(Quota.PARAMS_USED_A_LOT),
            "-ls": new Quota(Quota.PARAMS_USED_A_LOT)
        }
    }
    destroy() {
        this.ws.close();
        if (this.channel) {
            this.channel.emit("bye", this)
        }
        this.user;
        this.participantId;
        this.channel;
        this.server.roomlisteners.delete(this.connectionid);
        this.connectionid;
        this.server.connections.delete(this.connectionid);
        this.dead = true;
        console.log(`Removed Connection ${this.connectionid}.`);
    }
    bindEventListeners() {
        this.ws.on("message", (evt, admin) => {
            try {
                let transmission = JSON.parse(evt);
                for (let msg of transmission) {
                    if(this.dead) break;
                    if (!msg.hasOwnProperty("m")) return;
                    if (!this.server.legit_m.includes(msg.m)) return;
                    this.emit(msg.m, msg, !!admin);
                    //console.log(`RECIEVE: `, JSON.colorStringify(msg));
                }
            } catch (e) {
                console.log(e)
                this.destroy();
            }
        });
        this.ws.on("close", () => {
            if (!this.dead)
                this.destroy();
        });
        this.ws.addEventListener("error", (err) => {
            console.error(err);
            if (!this.dead)
                this.destroy();
        });
    }
}
export default Client;
