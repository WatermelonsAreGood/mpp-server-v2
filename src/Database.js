import bsql from 'better-sqlite3';
import {createHash } from "node:crypto";
import config from "../config.js"

class UserDatabase {
    constructor() {
        this.sql = bsql('users.db');
        this.sql.exec("CREATE TABLE IF NOT EXISTS users ( _id TEXT PRIMARY KEY, color TEXT, name TEXT, ip TEXT, flags TEXT, tag TEXT)")
    }

    get(_id) {
        let question =  this.sql.prepare('SELECT * FROM users WHERE _id = ?').get(_id);
        return question;
    }

    has(_id) {
        return (new Boolean(this.get(_id)) == true)
    }

    set(_id, user) {
        let flags = user.flags;
        if(typeof flags == "object") flags = JSON.stringify([...flags]);

        let tag = user.tag;
        if(typeof tag == "object") tag = JSON.stringify(tag);

        if(this.get(_id)) {
            this.sql.prepare("UPDATE users SET color = ?, name = ?, ip = ?, flags = ?, tag = ? WHERE _id = ?").run(user.color, user.name, user.ip, flags, tag, _id);
        } else {
            this.sql.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(_id, user.color, user.name, user.ip, flags, tag);
        }
    }
}

class SitebanDatabase {
    constructor() {
        this.sql = bsql('sitebans.db'); // TODO: eventaully merge both of these togehter
        this.sql.exec("CREATE TABLE IF NOT EXISTS bans ( _id TEXT PRIMARY KEY, reason TEXT, duration INTEGER, note TEXT, by TEXT, created NUMBER)")
    }

    getBan(_id) {
        let question = this.sql.prepare('SELECT * FROM bans WHERE _id = ?').get(_id);
        return question;
    }

    unban(_id) {
        if(this.getBan(_id)) {
            this.sql.prepare("DELETE FROM bans WHERE _id = ?").run(_id);
            return true;
        }

        return false;
    }

    ban(_id, reason, duration, note, by) {
        let created = Date.now()
        if(this.getBan(_id)) {
            this.sql.prepare("UPDATE bans SET reason = ?, duration = ?, note = ?, by = ?, created = ? WHERE _id = ?").run(reason, duration, note, by, created, _id);
        } else {
            this.sql.prepare("INSERT INTO bans VALUES (?, ?, ?, ?, ?, ?)").run(_id, reason, duration, note, by, created);
        }
    }
}

class TokenDatabase {
    constructor() {
        this.sql = bsql('tokens.db'); // TODO: these all have to be merged. please
        this.sql.exec("CREATE TABLE IF NOT EXISTS tokens ( token TEXT PRIMARY KEY, _id TEXT)")
    }

    getID(_id) {
        let question = this.sql.prepare('SELECT * FROM tokens WHERE _id = ?').get(_id);
        return question;
    }

    getToken(token) {
        let question = this.sql.prepare('SELECT * FROM tokens WHERE token = ?').get(token);
        return question;
    }

    generateToken(ip) {
        return createHash('sha512').update(config.salt + ip).digest('hex');
    }

    generateID() {
        let id = [...Array(24)].map(() =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");

        while (this.getID(id)) {
          id = [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16))
            .join("");
        }

        return id;
    }
    setToken(token, _id) {
        if(this.getToken(token)) {
            this.sql.prepare("UPDATE tokens SET token = ? WHERE _id = ?").run(token, _id);
        } else {
            this.sql.prepare("INSERT INTO tokens VALUES (?, ?)").run(token, _id);
        }
    }
}

export const userDatabase = new UserDatabase();
export const sitebanDatabase = new SitebanDatabase();
export const tokenDatabase = new TokenDatabase();
