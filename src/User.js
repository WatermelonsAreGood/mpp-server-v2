const fs = require("fs/promises")
const crypto = require("node:crypto")
const userDatabase = require("./Database.js").userDatabase;

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

class User {
    constructor(client) {
        this.client = client;
        this.server = this.client.server;
    }

    async getUserData() {
        let _id = buf2hex(await crypto.subtle.digest("sha-512", new TextEncoder().encode(this.client.server.salt + this.client.ip))).toString('hex').slice(0, 24);

        let user = {
            "color": `#${_id.slice(0, 6)}`,
            "name": this.server.defaultUsername,
            "_id": _id,
            "ip": this.client.ip,
            "flags": new Map()
        }

        if(userDatabase.has(_id)) {
            let semiRaw = userDatabase.get(_id);
            semiRaw.flags = new Map(JSON.parse(semiRaw.flags));
            semiRaw.tag = JSON.parse(semiRaw.tag);

            if(!semiRaw.tag) semiRaw.tag = undefined;

            user = semiRaw;
        } else {
            this.updateDatabase(user);
        }
        return user
    }

    updateDatabase(user) {
        userDatabase.set(user._id, user);
    }
}
module.exports = User;
