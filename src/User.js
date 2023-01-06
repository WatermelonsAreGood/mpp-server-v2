import { userDatabase } from "./Database.js";
import { createHash } from "crypto"

class User {
    constructor(client) {
        this.client = client;
        this.server = this.client.server;
    }

    getUserData() {
        let _id = this.client.token._id;

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
export default User;
