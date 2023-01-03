import Room from "./Room.js";
import message from "./Message.js"
import config from "../config.js";
import NewQuota from "./Quota.js"

import { EventEmitter } from "node:events"

class Client extends EventEmitter {
    constructor(ws, req, server) {
        super();
        this.user;
        this.connectionid = server.connectionid;
        this.server = server;
        this.participantId;
        this.channel;
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

        message(this);
    }
    initializeQuotes() {
        this.quotas = {
            mouseMove: new NewQuota(this, "mouseMove", [{
                allowance: 15e3,
                max: 5e5,
                interval: 2e3
            }]),
            chown: new NewQuota(this, "chown", [{
                allowance: 1,
                max: 10,
                time: 5e3
            }]),
            chat: new NewQuota(this, "chat", [
                {allowance:4,max:4,interval:6e3},
                {allowance:4,max:4,interval:6e3},
                {allowance:10,max:10,interval:2e3}
            ]),
            dm: new NewQuota(this, "dm", [
                {allowance:5,max:5,interval:6e3},
            ]),
            channelChange: new NewQuota(this, "channelChange", [{
                allowance: 1,
                max: 10,
                time: 2e3
            }]),
            userset: new NewQuota(this, "userset", [{
                allowance: 1,
                max: 30,
                time: 18e5
            }]),
            kickban: new NewQuota(this, "kickban", [{
                allowance: 1,
                max: 2,
                time: 1000
            }]),
            note: new NewQuota(this, "note", [
                {allowance:400,max:1200,interval:2e3},
                {allowance:200,max:600,interval:2e3},
                {allowance:600,max:1800,interval:2e3}
            ]),
        }
    }
    updateQuotaFlags(n) {
        Object.values(this.quotas).forEach(z => {
            z.updateFlags(n);
        })
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
    destroy() {
        this.ws.close();
        if (this.channel) this.channel.emit("bye", this)
        this.user;
        this.participantId;
        this.channel;
        this.server.roomlisteners.delete(this.connectionid);
        this.server.customListeners.delete(this.connectionid);

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
