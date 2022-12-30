const bsql = require('better-sqlite3');

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

module.exports = {userDatabase: new UserDatabase(), sitebanDatabase: new SitebanDatabase()};
